import path from "path";
import fs from "fs/promises";
import { logger } from "../../utils/logger";
import { generatePathHash, getFileDeviceInfo, calculateFileHash } from "../../utils/hash";
import { createHardlink } from "../../utils/hardlink";
import { getQueueService } from "../../queue/queueService";
import { ScrapingTaskData } from "../../types/queue.types";
import { getConfig } from "../../config/config";
import { PrismaClient } from '@/generated/client';
import client from '../../client';
import { LibraryStatus } from './libraryScanner';
import { FileDetails, IdentifiedMedia } from "../../types/media.types";
import { MediaRepository } from "../../repository/media.repository";

/**
 * 文件处理优先级枚举
 */
export enum FilePriority {
  /** 实时监听发现的文件 */
  REALTIME = 0,
  /** 定期扫描发现的文件 */
  SCHEDULED = 1,
  /** 手动触发的文件 */
  MANUAL = 2
}

/**
 * 文件处理源类型
 */
export enum FileSource {
  /** 实时监听 */
  REALTIME_WATCH = 'realtime_watch',
  /** 定期扫描 */
  SCHEDULED_SCAN = 'scheduled_scan',
  /** 手动处理 */
  MANUAL_PROCESS = 'manual_process'
}

/**
 * 文件处理参数接口
 */
export interface FileProcessOptions {
  /** 文件路径 */
  filePath: string;
  /** 文件名 */
  fileName: string;
  /** 是否为目录 */
  isDirectory: boolean;
  /** 处理优先级 */
  priority?: FilePriority;
  /** 文件来源 */
  source?: FileSource;
  /** 最大重试次数 */
  maxRetries?: number;
}

/**
 * 批量文件处理参数接口
 */
export interface BatchFileProcessOptions {
  /** 文件列表 */
  files: Array<{
    filePath: string;
    fileName: string;
    isDirectory: boolean;
  }>;
  /** 处理优先级 */
  priority?: FilePriority;
  /** 文件来源 */
  source?: FileSource;
  /** 最大重试次数 */
  maxRetries?: number;
}

/**
 * 统一文件处理器
 * 负责处理来自实时监听和定期扫描的文件，统一加入队列进行处理
 */
export class FileProcessor {
  private config = getConfig();
  private prisma: PrismaClient;
  private mediaRepository: MediaRepository;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || client;
    this.mediaRepository = new MediaRepository();
  }

  /**
   * 处理单个文件
   * @param options 文件处理选项
   * @returns 任务ID，如果文件不符合条件则返回null
   */
  public async processFile(options: FileProcessOptions): Promise<number | null> {
    const {
      filePath,
      fileName,
      isDirectory,
      priority = FilePriority.SCHEDULED,
      source = FileSource.SCHEDULED_SCAN,
      maxRetries = this.config.queue?.defaultMaxRetries
    } = options;

    // 验证文件是否存在
    try {
      await fs.access(filePath);
    } catch {
      logger.warn(`文件不存在，跳过处理: ${filePath}`);
      return null;
    }

    // 对于非目录文件，检查是否为支持的视频文件
    if (!isDirectory && !this.isValidVideoFile(fileName)) {
      logger.debug(`跳过非视频文件: ${fileName}`);
      return null;
    }

    logger.info(`[${source}] 准备处理文件: ${fileName} (目录: ${isDirectory})`);

    try {
      // 将文件添加到库中（如果尚不存在）
      const libraryId = await this.addFileToLibrary(filePath, isDirectory);
      
      // 对于视频文件，创建刮削任务
      if (!isDirectory || (isDirectory && source === FileSource.REALTIME_WATCH)) {
        const taskData: ScrapingTaskData = {
          filePath,
          fileName,
          isDirectory,
          priority,
          maxRetries
        };

        const queueService = getQueueService();
        
        // 确保队列服务已启动
        if (!queueService.isRunning()) {
          await queueService.start();
          logger.info(`[${source}] 队列服务已自动启动`);
        }

        const taskId = await queueService.enqueueTask(taskData);
        logger.info(`[${source}] 文件已加入队列: ${fileName} (任务ID: ${taskId}, 库ID: ${libraryId || 'N/A'})`);
        
        return taskId;
      } else {
        logger.info(`[${source}] 目录已添加到库: ${fileName} (库ID: ${libraryId || 'N/A'})`);
        return null;
      }
    } catch (error) {
      logger.error(`[${source}] 将文件加入队列失败: ${fileName}`, error);
      throw error;
    }
  }

  /**
   * 批量处理文件
   * @param options 批量处理选项
   * @returns 成功加入队列的任务ID列表
   */
  public async processFiles(options: BatchFileProcessOptions): Promise<number[]> {
    const {
      files,
      priority = FilePriority.SCHEDULED,
      source = FileSource.SCHEDULED_SCAN,
      maxRetries = this.config.queue?.defaultMaxRetries
    } = options;

    if (files.length === 0) {
      logger.info(`[${source}] 没有文件需要处理`);
      return [];
    }

    logger.info(`[${source}] 开始批量处理 ${files.length} 个文件`);

    // 过滤和验证文件，同时添加到库中
    const validTaskData: Array<{
      taskData: ScrapingTaskData;
      libraryId: number | null;
    }> = [];

    for (const file of files) {
      try {
        // 验证文件是否存在
        await fs.access(file.filePath);
        
        // 对于非目录文件，检查是否为支持的视频文件
        if (!file.isDirectory && !this.isValidVideoFile(file.fileName)) {
          logger.debug(`跳过非视频文件: ${file.fileName}`);
          continue;
        }

        // 将文件添加到库中
        const libraryId = await this.addFileToLibrary(file.filePath, file.isDirectory);

        // 只有视频文件才需要刮削
        if (!file.isDirectory && libraryId) {
          validTaskData.push({
            taskData: {
              filePath: file.filePath,
              fileName: file.fileName,
              isDirectory: file.isDirectory,
              priority,
              maxRetries
            },
            libraryId
          });
        }
      } catch {
        logger.warn(`文件不存在，跳过处理: ${file.filePath}`);
      }
    }

    if (validTaskData.length === 0) {
      logger.info(`[${source}] 没有有效的视频文件需要刮削`);
      return [];
    }

    try {
      const queueService = getQueueService();
      
      // 确保队列服务已启动
      if (!queueService.isRunning()) {
        await queueService.start();
        logger.info(`[${source}] 队列服务已自动启动`);
      }

      // 批量添加到队列
      const taskDataList = validTaskData.map(item => item.taskData);
      const taskIds = await queueService.enqueueTasks(taskDataList);
      
      logger.info(`[${source}] 成功将 ${taskIds.length} 个文件加入队列，任务ID: [${taskIds.join(', ')}]`);
      
      return taskIds;
    } catch (error) {
      logger.error(`[${source}] 批量处理文件失败`, error);
      throw error;
    }
  }

  /**
   * 处理文件事件（用于实时监听）
   * 只处理文件的 add 和 change 事件，目录由定期扫描处理
   * @param eventType 事件类型 (add | change)
   * @param fileInfo 文件信息
   */
  public async handleFileEvent(
    eventType: string,
    fileInfo: { path: string; filename: string; isDirectory: boolean }
  ): Promise<number | null> {
    // 只处理新增和修改事件
    if (eventType !== "add" && eventType !== "change") {
      return null;
    }

    logger.info(
      `[实时监听] 检测到事件: 类型=${eventType}, 路径=${fileInfo.path}, 目录?=${fileInfo.isDirectory}`
    );

    return await this.processFile({
      filePath: fileInfo.path,
      fileName: fileInfo.filename,
      isDirectory: fileInfo.isDirectory,
      priority: FilePriority.REALTIME,
      source: FileSource.REALTIME_WATCH
    });
  }

  /**
   * 处理扫描发现的文件（用于定期扫描）
   * @param files 扫描到的文件列表
   */
  public async handleScannedFiles(files: Array<{
    path: string;
    type: 'video' | 'subtitle';
    size: number;
    pathHash: string;
  }>): Promise<number[]> {
    // 只处理视频文件，跳过字幕文件
    const videoFiles = files.filter(file => file.type === 'video');
    
    if (videoFiles.length === 0) {
      return [];
    }

    const fileList = videoFiles.map(file => ({
      filePath: file.path,
      fileName: path.basename(file.path),
      isDirectory: false
    }));

    return await this.processFiles({
      files: fileList,
      priority: FilePriority.SCHEDULED,
      source: FileSource.SCHEDULED_SCAN
    });
  }

  /**
   * 检查文件是否为支持的视频格式
   * @param filename 文件名
   * @returns 是否为视频文件
   */
  private isValidVideoFile(filename: string): boolean {
    const fileExt = path.extname(filename).toLowerCase();
    const isValid = this.config.videoExtensions.includes(fileExt);
    if (!isValid) {
      logger.debug(`跳过非视频文件: ${filename}`);
    }
    return isValid;
  }

  /**
   * 检查文件是否已存在于库中
   * @param filePath 文件路径
   * @returns 是否已存在
   */
  private async isFileInLibrary(filePath: string): Promise<boolean> {
    const pathHash = generatePathHash(filePath);
    const existing = await this.prisma.library.findFirst({
      where: { pathHash }
    });
    return !!existing;
  }

  /**
   * 将文件添加到库中
   * @param filePath 文件路径
   * @param isDirectory 是否为目录
   * @returns 库记录ID
   */
  private async addFileToLibrary(filePath: string, isDirectory: boolean): Promise<number | null> {
    try {
      // 检查文件是否已存在
      const pathHash = generatePathHash(filePath);
      const existing = await this.prisma.library.findFirst({
        where: { pathHash }
      });

      if (existing) {
        logger.debug(`文件已存在于库中: ${filePath}`);
        return existing.id;
      }

      // 获取文件信息
      let fileSize = 0;
      let fileType: 'video' | 'subtitle' = 'video';

      if (!isDirectory) {
        try {
          const stats = await fs.stat(filePath);
          fileSize = stats.size;
          
          const ext = path.extname(filePath).toLowerCase();
          const isVideo = this.config.videoExtensions.includes(ext);
          const isSubtitle = this.config.subtitleExtensions.includes(ext);
          
          if (!isVideo && !isSubtitle) {
            logger.debug(`跳过不支持的文件类型: ${filePath}`);
            return null;
          }
          
          fileType = isVideo ? 'video' : 'subtitle';
        } catch (error) {
          logger.warn(`获取文件信息失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
          return null;
        }
      }

      // 创建库记录
      const libraryRecord = await this.prisma.library.create({
        data: {
          type: fileType,
          path: filePath,
          pathHash,
          size: BigInt(fileSize),
          status: LibraryStatus.PENDING
        }
      });

      logger.info(`文件已添加到库: ${filePath} (ID: ${libraryRecord.id})`);
      return libraryRecord.id;
    } catch (error) {
      logger.error(`添加文件到库失败: ${filePath}`, error);
      return null;
    }
  }

  /**
   * 获取队列状态信息
   */
  public async getQueueStatus() {
    const queueService = getQueueService();
    return {
      isRunning: queueService.isRunning(),
      // 这里可以添加更多队列状态信息，如待处理任务数量等
    };
  }

  /**
   * 确保队列服务已启动
   */
  public async ensureQueueService(): Promise<void> {
    const queueService = getQueueService();
    if (!queueService.isRunning()) {
      await queueService.start();
      logger.info('队列服务已启动');
    }
  }

  /**
   * 停止队列服务
   */
  public async stopQueueService(): Promise<void> {
    const queueService = getQueueService();
    if (queueService.isRunning()) {
      await queueService.stop();
      logger.info('队列服务已停止');
    }
  }

  /**
   * 处理单个视频文件：验证、构建目标路径、创建硬链接并保存记录
   * @param fileInfo 文件信息
   * @param media 已识别的媒体信息
   * @param targetPath 目标目录路径
   * @param isSaveDatabase 是否保存到数据库
   * @returns FileDetails或void
   */
  public async handleSingleFile(
    fileInfo: { path: string; filename: string },
    media: IdentifiedMedia,
    targetPath: string,
    isSaveDatabase = true
  ): Promise<FileDetails | void> {
    if (!this.isValidVideoFile(fileInfo.filename)) {
      return;
    }

    const fileExt = path.extname(fileInfo.filename);
    const targetFileName = this.buildTargetFileName(media, fileExt);
    const targetFilePath = path.join(targetPath, targetFileName);

    await fs.mkdir(targetPath, { recursive: true });

    const fileDetails = await this.prepareFileDetails(
      fileInfo.path,
      targetFilePath
    );

    if (isSaveDatabase) {
      await this.mediaRepository.saveMediaAndFile(media, fileDetails);
    }

    return fileDetails;
  }

  /**
   * 根据媒体信息构建目标目录的完整路径
   * @param media 已识别的媒体信息
   * @returns 目标目录路径
   */
  public buildTargetPath(media: IdentifiedMedia): string {
    let targetPath = path.join(this.config.targetFilePath, media.title);
    if (media.type === "tv" && media.seasonNumber) {
      targetPath = path.join(targetPath, `Season ${media.seasonNumber}`);
    }
    return targetPath;
  }

  /**
   * 为单个文件创建硬链接
   * @param filePath 文件路径
   * @returns Promise<void>
   */
  public async createHardlinkForFile(filePath: string): Promise<void> {
    try {
      // 直接创建硬链接，不经过刮削流程
      const targetPath = path.join(
        this.config.targetFilePath,
        path.basename(filePath)
      );
      
      await createHardlink(filePath, targetPath);
      logger.info(`成功创建硬链接: ${filePath} -> ${targetPath}`);
    } catch (error) {
      logger.error(`创建硬链接失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 根据媒体信息和文件扩展名构建目标文件名
   * @param media 已识别的媒体信息
   * @param fileExt 文件扩展名
   * @returns 目标文件名
   */
  private buildTargetFileName(media: IdentifiedMedia, fileExt: string): string {
    let targetFileName = media.title;
    if (media.type === "tv") {
      targetFileName = `${media.title} S${String(media.seasonNumber).padStart(
        2,
        "0"
      )}E${String(media.episodeNumber).padStart(2, "0")} ${
        media.episodeTitle || ""
      }`.trim();
    }
    return targetFileName + fileExt;
  }

  /**
   * 创建硬链接并收集文件的物理和计算出的详细信息
   * @param sourcePath 源文件路径
   * @param targetPath 目标链接路径
   * @returns 包含文件详细信息的对象
   */
  private async prepareFileDetails(
    sourcePath: string,
    targetPath: string
  ): Promise<FileDetails> {
    try {
      await createHardlink(sourcePath, targetPath);
      const deviceInfo = await getFileDeviceInfo(sourcePath);
      const fileHash = await calculateFileHash(sourcePath, Number(deviceInfo.size));

      return {
        sourcePath: sourcePath,
        linkPath: targetPath,
        deviceId: deviceInfo.deviceId,
        inode: deviceInfo.inode,
        fileSize: deviceInfo.size,
        fileHash: fileHash,
      };
    } catch (error) {
      logger.error(`准备文件详情时出错 (源: ${sourcePath})`, error);
      throw error;
    }
  }
}