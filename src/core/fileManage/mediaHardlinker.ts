// REFACTOR: 封装为服务类，移除自动启动逻辑，并实现完全异步I/O
import { getConfig, Config } from "../../config/config";
import { FileMonitor, FileMonitorOptions } from "./fileMonitor";
import { getContainer } from "./container";
import { FileProcessor } from "./fileProcessor";
import fs from "fs/promises";
import { logger } from "../../utils/logger";
import {
  FileDetails,
  IdentifiedMedia,
} from "../../types/media.types";

/**
 * @class MediaHardlinkerService
 * @description 核心服务类，用于管理整个媒体硬链接流程。
 * 现在基于队列系统进行异步处理，避免UI卡顿和API限制问题。
 */
export class MediaHardlinkerService {
  private config: Config;
  private fileMonitorInstance: FileMonitor | null = null;
  private stopMonitoring: (() => Promise<boolean>) | null = null;
  private fileProcessor: FileProcessor;

  constructor() {
    this.config = getConfig();
    const container = getContainer();
    this.fileProcessor = container.getFileProcessor();
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

    // 启动队列服务
    await this.fileProcessor.ensureQueueService();

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
   * 此方法会安全地停止文件监控器和队列服务。
   * @returns {Promise<void>}
   */
  public async stop(): Promise<void> {
    if (this.stopMonitoring) {
      logger.info("正在停止媒体硬链接服务...");
      await this.stopMonitoring();
      this.stopMonitoring = null;
      this.fileMonitorInstance = null;
    }

    // 停止队列服务
    await this.fileProcessor.stopQueueService();
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
    try {
      // 使用统一的文件处理器处理事件
      await this.fileProcessor.handleFileEvent(eventType, fileInfo);
    } catch (error) {
      logger.error(`处理文件事件失败: ${fileInfo.filename}`, error);
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
    return await this.fileProcessor.handleSingleFile(fileInfo, media, targetPath, isSaveDatabase);
  }

  /**
   * @public
   * @method buildTargetPath
   * @description 根据媒体信息构建目标目录的完整路径。
   * @param {IdentifiedMedia} media - 已识别的媒体信息.
   * @returns {string} 目标目录路径.
   */
  public buildTargetPath(media: IdentifiedMedia): string {
    return this.fileProcessor.buildTargetPath(media);
  }

  /**
   * @public
   * @method createHardlinkForFile
   * @description 为单个文件创建硬链接
   * @param filePath 文件路径
   * @returns {Promise<void>}
   */
  public async createHardlinkForFile(filePath: string): Promise<void> {
    return await this.fileProcessor.createHardlinkForFile(filePath);
  }
}
