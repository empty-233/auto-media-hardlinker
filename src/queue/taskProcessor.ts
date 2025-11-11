import { IMediaIdentifier, IdentifiedMedia } from "../types/media.types";
import { MediaRepository } from "../repository/media.repository";
import { MediaHardlinkerService } from "../core/fileManage/mediaHardlinker";
import { LLMIdentifier } from "../strategies/llm.identifier";
import { RegexIdentifier } from "../strategies/regex.identifier";
import { getConfig } from "../config/config";
import { logger } from "../utils/logger";
import { getFileDeviceInfo } from "../utils/hash";
import { TaskResult, QueueTask } from "../types/queue.types";
import { NonRetryableError } from "../core/errors";
import { getContainer } from "../core/fileManage/container";
import { FolderDetails, SpecialFolderProcessResult } from "../types/specialFolder.types";

/**
 * 任务处理器 - 统一处理普通文件和特殊文件夹
 */
export class TaskProcessor {
  private mediaRepository: MediaRepository;
  private hardlinkerService: MediaHardlinkerService;
  private config = getConfig();

  constructor() {
    this.mediaRepository = new MediaRepository();
    this.hardlinkerService = new MediaHardlinkerService();
  }

  /**
   * 判断是否为特殊文件夹（快速检查，不调用 LLM）
   */
  private async isSpecialFolder(folderPath: string): Promise<boolean> {
    try {
      const container = getContainer();
      const specialFolderProcessor = container.getSpecialFolderProcessor();
      // 使用快速规则检查，不调用 LLM
      const result = await specialFolderProcessor.isPotentialSpecialFolder(folderPath);
      return result.isPotential;
    } catch (error) {
      logger.error(`判断特殊文件夹失败: ${folderPath}`, error);
      return false;
    }
  }

  /**
   * 处理单个刮削任务（统一处理普通文件和特殊文件夹）
   */
  async processTask(task: QueueTask): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`开始处理任务: ${task.fileName} (ID: ${task.id})`);

      // 判断是否为特殊文件夹（BDMV/DVD等）
      if (task.isDirectory && await this.isSpecialFolder(task.filePath)) {
        return await this.processSpecialFolder(task, startTime);
      }

      // 处理普通文件
      return await this.processNormalFile(task, startTime);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      logger.error(`任务处理失败: ${task.fileName} (ID: ${task.id})`, error);

      return {
        success: false,
        error: errorMessage,
        processingTime,
        isNonRetryable: error instanceof NonRetryableError,
      };
    }
  }

  /**
   * 处理特殊文件夹（BDMV/DVD/ISO等）
   * 统一在 TaskProcessor 中保存数据库
   */
  private async processSpecialFolder(task: QueueTask, startTime: number): Promise<TaskResult> {
    try {
      logger.info(`[特殊文件夹] 开始处理: ${task.fileName}`);

      const container = getContainer();
      const specialFolderProcessor = container.getSpecialFolderProcessor();

      // 调用 processFolder 获取处理结果
      const results: SpecialFolderProcessResult[] = await specialFolderProcessor.processFolder(task.filePath);

      if (results.length === 0) {
        logger.warn(`[特殊文件夹] 无有效结果: ${task.fileName}`);
        return {
          success: true,
          processingTime: Date.now() - startTime
        };
      }

      // 统一保存到数据库
      const savedIds: number[] = [];
      const failedPaths: string[] = [];
      
      // 判断是否为多子卷结构（多于1个结果）
      const isMultiVolume = results.length > 1;
      let parentFolderId: number | undefined;
      
      // 如果是多子卷结构，先创建父文件夹记录
      if (isMultiVolume) {
        try {
          const firstResult = results[0];
          const identifiedMedia: IdentifiedMedia = {
            type: firstResult.mediaInfo.mediaType,
            tmdbId: firstResult.mediaInfo.tmdbId,
            title: firstResult.mediaInfo.title,
            originalTitle: firstResult.mediaInfo.originalTitle || '',
            releaseDate: firstResult.mediaInfo.releaseDate ? new Date(firstResult.mediaInfo.releaseDate) : null,
            description: firstResult.mediaInfo.description,
            posterPath: firstResult.mediaInfo.posterPath,
            backdropPath: null,
            rawData: null,
          };
          
          parentFolderId = await this.mediaRepository.createParentFolderRecord(
            identifiedMedia,
            task.filePath
          );
          
          logger.info(`[特殊文件夹] 创建父文件夹记录: ${task.filePath} (Parent ID: ${parentFolderId})`);
        } catch (error) {
          logger.error(`[特殊文件夹] 创建父文件夹记录失败: ${task.filePath}`, error);
        }
      }
      
      for (const result of results) {
        try {
          const { folderInfo, linkPath, mediaInfo } = result;

          // 获取文件夹的设备信息
          const deviceInfo = await getFileDeviceInfo(folderInfo.path);

          // 构建 IdentifiedMedia 对象
          const identifiedMedia: IdentifiedMedia = {
            type: mediaInfo.mediaType,
            tmdbId: mediaInfo.tmdbId,
            title: mediaInfo.title,
            originalTitle: mediaInfo.originalTitle || '',
            releaseDate: mediaInfo.releaseDate ? new Date(mediaInfo.releaseDate) : null,
            description: mediaInfo.description,
            posterPath: mediaInfo.posterPath,
            backdropPath: null,
            rawData: null,
          };

          // 构建文件夹详细信息
          const folderDetails: FolderDetails = {
            sourcePath: folderInfo.path,
            linkPath: linkPath,
            deviceId: deviceInfo.deviceId,
            inode: deviceInfo.inode,
            fileHash: null,
            fileSize: BigInt(folderInfo.totalSize),
            folderType: folderInfo.type,
            isMultiDisc: folderInfo.isMultiDisc || false,
            discNumber: folderInfo.discNumber || null,
          };

          // 保存到数据库，如果是多卷结构则关联父文件夹
          const fileRecord = await this.mediaRepository.saveMediaAndFolder(
            identifiedMedia, 
            folderDetails,
            parentFolderId
          );
          savedIds.push(fileRecord.id);

          logger.info(`[特殊文件夹] ✅ 已保存到数据库: ${folderInfo.path} (File ID: ${fileRecord.id})`);
        } catch (error) {
          logger.error(`[特殊文件夹] 保存数据库失败: ${result.folderInfo.path}`, error);
          failedPaths.push(result.folderInfo.path);
        }
      }

      const processingTime = Date.now() - startTime;
      const totalCount = results.length;
      const successCount = savedIds.length;
      const failedCount = failedPaths.length;
      
      if (failedCount > 0) {
        logger.warn(`[特殊文件夹] 部分保存失败: ${task.fileName} - 成功 ${successCount}/${totalCount}, 失败路径: ${failedPaths.join(', ')}`);
      } else {
        logger.info(`[特殊文件夹] 处理完成: ${task.fileName} (ID: ${task.id}), 共保存 ${successCount} 个, 耗时: ${processingTime}ms`);
      }

      return {
        success: savedIds.length > 0,
        processingTime,
        fileId: savedIds[0],
        metadata: {
          totalCount,
          successCount,
          failedCount,
          failedPaths: failedCount > 0 ? failedPaths : undefined
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[特殊文件夹] 处理失败: ${task.fileName}`, error);
      throw new Error(errorMessage);
    }
  }

  /**
   * 处理普通文件
   */
  private async processNormalFile(task: QueueTask, startTime: number): Promise<TaskResult> {
    try {
      // 选择识别策略
      const identifier: IMediaIdentifier = this.config.useLlm
        ? new LLMIdentifier()
        : new RegexIdentifier();

      // 识别媒体
      const media = await identifier.identify(
        task.fileName,
        task.isDirectory,
        task.filePath
      );

      if (!media) {
        throw new Error(`无法识别媒体文件: ${task.fileName}`);
      }

      logger.info(`成功识别媒体: ${media.title} (任务ID: ${task.id})`);

      // 构建目标路径
      const targetPath = this.hardlinkerService.buildTargetPath(media);

      // 处理文件或目录
      let fileId: number | undefined;
      let mediaId: number | undefined;

      if (task.isDirectory) {
        // 对于普通目录，只创建目录结构
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`处理普通文件失败: ${task.fileName}`, error);
      throw new Error(errorMessage);
    }
  }
}
