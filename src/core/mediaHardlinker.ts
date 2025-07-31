// REFACTOR: 封装为服务类，移除自动启动逻辑，并实现完全异步I/O
import { getConfig, Config } from "../config/config";
import { FileMonitor, FileMonitorOptions } from "./fileMonitor";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { logger } from "../utils/logger";
import {
  IMediaIdentifier,
  FileDetails,
  IdentifiedMedia,
} from "../types/media.types";
import { LLMIdentifier } from "../strategies/llm.identifier";
import { RegexIdentifier } from "../strategies/regex.identifier";
import { MediaRepository } from "../repository/media.repository";
import { createHardlink } from "../utils/hardlink";

/**
 * @class MediaHardlinkerService
 * @description 核心服务类，用于管理整个媒体硬链接流程。
 * 包含文件监控的启动、停止以及处理文件事件的逻辑。
 */
export class MediaHardlinkerService {
  private config: Config;
  private mediaRepository: MediaRepository;
  private fileMonitorInstance: FileMonitor | null = null;
  private stopMonitoring: (() => Promise<boolean>) | null = null;

  constructor() {
    this.config = getConfig();
    this.mediaRepository = new MediaRepository();
  }

  /**
   * @public
   * @method start
   * @description 启动媒体硬链接服务。
   * 此方法会验证配置，并初始化文件监控器以监听指定目录的变化。
   * @returns {Promise<void>}
   */
  public async start(): Promise<void> {
    logger.info("启动媒体硬链接服务...");
    try {
      await fs.access(this.config.monitorFilePath);
    } catch (error) {
      logger.error(
        `配置中的监视器文件路径无效或无法访问: ${this.config.monitorFilePath}`,
        error
      );
      throw new Error(`监视器路径设置无效: ${this.config.monitorFilePath}`);
    }

    const monitorOptions: FileMonitorOptions = {
      usePolling: true,
    };

    this.fileMonitorInstance = new FileMonitor(
      this.config.monitorFilePath,
      monitorOptions
    );
    this.stopMonitoring = this.fileMonitorInstance.watchFile(
      this.handleFileEvent.bind(this)
    );
    logger.info(`服务已启动，正在监控路径: ${this.config.monitorFilePath}`);
  }

  /**
   * @public
   * @method stop
   * @description 停止媒体硬链接服务。
   * 此方法会安全地停止文件监控器。
   * @returns {Promise<void>}
   */
  public async stop(): Promise<void> {
    if (this.stopMonitoring) {
      logger.info("正在停止媒体硬链接服务...");
      await this.stopMonitoring();
      this.stopMonitoring = null;
      this.fileMonitorInstance = null;
    }
  }

  /**
   * @private
   * @method handleFileEvent
   * @description 处理文件监控器触发的文件事件。
   * @param {string} eventType - 事件类型 ('add', 'addDir', 'change').
   * @param {{ path: string; filename: string; isDirectory: boolean }} fileInfo - 文件信息.
   * @returns {Promise<void>}
   */
  private async handleFileEvent(
    eventType: string,
    fileInfo: { path: string; filename: string; isDirectory: boolean }
  ): Promise<void> {
    if (
      eventType !== "add" &&
      eventType !== "addDir" &&
      eventType !== "change"
    ) {
      return;
    }

    logger.info(
      `检测到事件: 类型=${eventType}, 路径=${fileInfo.path}, 目录?=${fileInfo.isDirectory}`
    );

    try {
      await this.processMediaFile(fileInfo);
    } catch (error) {
      logger.error(`处理文件 ${fileInfo.filename} 时发生顶层错误`, error);
    }
  }

  /**
   * @private
   * @method processMediaFile
   * @description 完整处理单个媒体文件或目录的流程。
   * @param {{ path: string; filename: string; isDirectory: boolean }} fileInfo - 文件信息.
   * @returns {Promise<void>}
   */
  private async processMediaFile(fileInfo: {
    path: string;
    filename: string;
    isDirectory: boolean;
  }): Promise<void> {
    // 1. 选择识别策略
    const refreshConfig = getConfig();
    const identifier: IMediaIdentifier = refreshConfig.useLlm
      ? new LLMIdentifier()
      : new RegexIdentifier();

    // 2. 识别媒体
    const media = await identifier.identify(
      fileInfo.filename,
      fileInfo.isDirectory,
      fileInfo.path
    );
    if (!media) {
      logger.warn(`无法识别媒体文件: ${fileInfo.filename}`);
      return;
    }
    logger.info(`成功识别媒体: ${media.title}`);

    // 3. 构建目标路径
    const targetPath = this.buildTargetPath(media);

    // 4. 处理目录和硬链接
    if (fileInfo.isDirectory) {
      await fs.mkdir(targetPath, { recursive: true });
      logger.info(`创建或确认目录: ${targetPath}`);
    } else {
      await this.handleSingleFile(fileInfo, media, targetPath);
    }
  }

  /**
   * @public
   * @method handleSingleFile
   * @description 处理单个视频文件：验证、构建目标路径、创建硬链接并保存记录。
   * @param {{ path: string; filename: string }} fileInfo - 文件信息.
   * @param {IdentifiedMedia} media - 已识别的媒体信息.
   * @param {string} targetPath - 目标目录路径.
   * @returns {Promise<FileDetails|void>}
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

    if (isSaveDatabase)
      await this.mediaRepository.saveMediaAndFile(media, fileDetails);

    return fileDetails;
  }

  /**
   * @private
   * @method isValidVideoFile
   * @description 检查文件是否为支持的视频格式。
   * @param {string} filename - 文件名。
   * @returns {boolean} - 如果是视频文件则返回true，否则返回false。
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
   * @private
   * @method prepareFileDetails
   * @description 创建硬链接并收集文件的物理和计算出的详细信息。
   * @param {string} sourcePath - 源文件路径。
   * @param {string} targetPath - 目标链接路径。
   * @returns {Promise<FileDetails | null>} 包含文件详细信息的对象，如果失败则返回null。
   */
  private async prepareFileDetails(
    sourcePath: string,
    targetPath: string
  ): Promise<FileDetails> {
    try {
      await createHardlink(sourcePath, targetPath);
      const stats = await fs.stat(sourcePath);
      const fileHash = await this.calculateFileHash(sourcePath, stats.size);

      return {
        sourcePath: sourcePath,
        linkPath: targetPath,
        deviceId: stats.dev,
        inode: stats.ino,
        fileSize: stats.size,
        fileHash: fileHash,
      };
    } catch (error) {
      logger.error(`准备文件详情时出错 (源: ${sourcePath})`, error);
      throw error;
    }
  }

  /**
   * @public
   * @method buildTargetPath
   * @description 根据媒体信息构建目标目录的完整路径。
   * @param {IdentifiedMedia} media - 已识别的媒体信息.
   * @returns {string} 目标目录路径.
   */
  public buildTargetPath(media: IdentifiedMedia): string {
    let targetPath = path.join(this.config.targetFilePath, media.title);
    if (media.type === "tv" && media.seasonNumber) {
      targetPath = path.join(targetPath, `Season ${media.seasonNumber}`);
    }
    return targetPath;
  }

  /**
   * @private
   * @method buildTargetFileName
   * @description 根据媒体信息和文件扩展名构建目标文件名。
   * @param {IdentifiedMedia} media - 已识别的媒体信息.
   * @param {string} fileExt - 文件扩展名.
   * @returns {string} 目标文件名.
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
   * @private
   * @method calculateFileHash
   * @description 计算文件的MD5哈希值，用于唯一标识文件。
   * @param {string} filePath - 文件路径.
   * @param {number} fileSize - 文件大小.
   * @returns {Promise<string>} 文件的MD5哈希值.
   */
  private async calculateFileHash(
    filePath: string,
    fileSize: number
  ): Promise<string> {
    const hashSum = crypto.createHash("md5");
    let fileHandle;
    try {
      fileHandle = await fs.open(filePath, "r");
      const bufferSize = 1024 * 1024; // 1MB
      const buffer = Buffer.alloc(bufferSize);

      const { bytesRead: headBytesRead } = await fileHandle.read(
        buffer,
        0,
        Math.min(bufferSize, fileSize),
        0
      );
      hashSum.update(buffer.slice(0, headBytesRead));

      if (fileSize > bufferSize * 2) {
        const { bytesRead: midBytesRead } = await fileHandle.read(
          buffer,
          0,
          bufferSize,
          Math.floor(fileSize / 2) - bufferSize / 2
        );
        hashSum.update(buffer.slice(0, midBytesRead));
      }

      if (fileSize > bufferSize) {
        const { bytesRead: tailBytesRead } = await fileHandle.read(
          buffer,
          0,
          Math.min(bufferSize, fileSize),
          Math.max(0, fileSize - bufferSize)
        );
        hashSum.update(buffer.slice(0, tailBytesRead));
      }

      hashSum.update(fileSize.toString());
      return hashSum.digest("hex");
    } finally {
      await fileHandle?.close();
    }
  }
}
