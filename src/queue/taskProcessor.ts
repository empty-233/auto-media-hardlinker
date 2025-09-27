import { IMediaIdentifier } from "../types/media.types";
import { MediaRepository } from "../repository/media.repository";
import { MediaHardlinkerService } from "../core/fileManage/mediaHardlinker";
import { LLMIdentifier } from "../strategies/llm.identifier";
import { RegexIdentifier } from "../strategies/regex.identifier";
import { getConfig } from "../config/config";
import { logger } from "../utils/logger";
import { TaskResult } from "../types/queue.types";
import { NonRetryableError } from "../core/errors";

/**
 * 任务处理器 - 负责处理具体的刮削任务
 */
export class TaskProcessor {
  private mediaRepository: MediaRepository;
  private hardlinkerService: MediaHardlinkerService;

  constructor() {
    this.mediaRepository = new MediaRepository();
    this.hardlinkerService = new MediaHardlinkerService();
  }

  /**
   * 处理单个刮削任务
   */
  async processTask(task: any): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`开始处理任务: ${task.fileName} (ID: ${task.id})`);

      // 1. 选择识别策略
      const config = getConfig();
      const identifier: IMediaIdentifier = config.useLlm
        ? new LLMIdentifier()
        : new RegexIdentifier();

      // 2. 识别媒体
      const media = await identifier.identify(
        task.fileName,
        task.isDirectory,
        task.filePath
      );

      if (!media) {
        throw new Error(`无法识别媒体文件: ${task.fileName}`);
      }

      logger.info(`成功识别媒体: ${media.title} (任务ID: ${task.id})`);

      // 3. 构建目标路径
      const targetPath = this.hardlinkerService.buildTargetPath(media);

      // 4. 处理文件或目录
      let fileId: number | undefined;
      let mediaId: number | undefined;

      if (task.isDirectory) {
        // 对于目录，只创建目录结构，不处理文件
        const fs = await import("fs/promises");
        await fs.mkdir(targetPath, { recursive: true });
        logger.info(`创建目录: ${targetPath} (任务ID: ${task.id})`);
      } else {
        // 处理单个文件
        const fileDetails = await this.hardlinkerService.handleSingleFile(
          { path: task.filePath, filename: task.fileName },
          media,
          targetPath,
          false // 暂时不保存到数据库，稍后统一保存
        );

        if (fileDetails) {
          // 保存媒体和文件信息到数据库
          const fileRecord = await this.mediaRepository.saveMediaAndFile(media, fileDetails);
          fileId = fileRecord.id;
          mediaId = fileRecord.mediaId || undefined;
        }
      }

      const processingTime = Date.now() - startTime;
      logger.info(`任务处理完成: ${task.fileName} (ID: ${task.id}), 耗时: ${processingTime}ms`);

      return {
        success: true,
        mediaId,
        fileId,
        processingTime
      };

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      logger.error(`任务处理失败: ${task.fileName} (ID: ${task.id})`, error);

      return {
        success: false,
        error: error.message || "未知错误",
        processingTime,
        isNonRetryable: error instanceof NonRetryableError,
      };
    }
  }
}
