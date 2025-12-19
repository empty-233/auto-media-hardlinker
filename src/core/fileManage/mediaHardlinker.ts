// REFACTOR: 封装为服务类，移除自动启动逻辑，并实现完全异步I/O
import { getConfig, Config } from "@/config/config";
import { FileMonitor } from "./fileMonitor";
import { getContainer } from "./container";
import { FileProcessor } from "./fileProcessor";
import fs from "fs/promises";
import { logger } from "@/utils/logger";
import {
  FileDetails,
  IdentifiedMedia,
} from "@/types/media.types";

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
   * @returns {Promise<void>}
   * @throws {Error} 启动失败时抛出错误
   */
  public async start(): Promise<void> {
    if (this.fileMonitorInstance || this.stopMonitoring) {
      throw new Error("媒体硬链接服务已经在运行中");
    }

    logger.info("启动媒体硬链接服务...");

    // 验证监控路径
    const stats = await fs.stat(this.config.monitorFilePath);
    if (!stats.isDirectory()) {
      throw new Error(`监控路径不是有效目录: ${this.config.monitorFilePath}`);
    }

    // 验证配置
    if (!this.config.videoExtensions?.length) {
      throw new Error("未配置视频文件扩展名");
    }

    // 启动队列服务
    await this.fileProcessor.ensureQueueService();

    // 构建视频扩展名列表
    const videoExtensions = this.config.videoExtensions.map(ext => 
      ext.startsWith('.') ? ext : `.${ext}`
    );

    // 初始化文件监控器 - 只监听视频文件的add和change事件
    // 特殊文件夹（BDMV/DVD等）交由定时扫描处理
    this.fileMonitorInstance = new FileMonitor(
      this.config.monitorFilePath,
      {
        ignored: (filePath: string, stats?: any) => {
          // 文件夹需要遍历，但不触发事件（在 fileMonitor 中过滤）
          if (stats?.isDirectory?.() === true) {
            return false;
          }
          // 只监听视频文件
          if (stats?.isFile?.() === true) {
            return !videoExtensions.some(ext => 
              filePath.toLowerCase().endsWith(ext.toLowerCase())
            );
          }
          return false;
        },
      }
    );
    
    this.stopMonitoring = this.fileMonitorInstance.watchFile(
      this.fileProcessor.handleFileEvent.bind(this.fileProcessor)
    );
    
    logger.info(`服务已启动，监控: ${this.config.monitorFilePath}`);
    logger.info(`视频类型: ${videoExtensions.join(', ')}`);
  }

  /**
   * @private
   * @method cleanup
   * @description 清理服务资源
   * @returns {Promise<void>}
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.stopMonitoring) {
        await this.stopMonitoring();
        this.stopMonitoring = null;
      }
      this.fileMonitorInstance = null;
      await this.fileProcessor.stopQueueService();
    } catch (error) {
      logger.error("清理资源时出错", error);
    }
  }

  /**
   * @public
   * @method stop
   * @description 停止媒体硬链接服务。
   * 此方法会安全地停止文件监控器和队列服务。
   * @returns {Promise<void>}
   */
  public async stop(): Promise<void> {
    logger.info("正在停止媒体硬链接服务...");
    await this.cleanup();
    logger.info("服务已停止");
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
