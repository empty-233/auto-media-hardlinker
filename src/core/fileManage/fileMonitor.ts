import chokidar, { FSWatcher } from "chokidar";
import path from "path";
import { logger } from "@/utils/logger";
import fs from "fs/promises";

/**
 * 文件监控器配置选项
 */
export interface FileMonitorOptions {
  persistent?: boolean;
  depth?: number;
  usePolling?: boolean;
  ignoreInitial?: boolean;
  ignored?: RegExp | string | Array<RegExp | string> | ((path: string, stats?: any) => boolean);
  cwd?: string;
  awaitWriteFinish?: {
    stabilityThreshold?: number;
    pollInterval?: number;
  };
}

type EventCallback = (eventType: string, fileInfo: { path: string; filename: string; isDirectory: boolean }) => void;

/**
 * @class FileMonitor
 * @description 一个基于chokidar的健壮文件系统监控器。
 */
export class FileMonitor {
  private readonly filePath: string;
  private readonly options: FileMonitorOptions;

  constructor(filePath: string, options: FileMonitorOptions) {
    this.filePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    
    this.options = {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      },
      ...options,
    };
  }

  /**
   * @method watchFile
   * @description 初始化并开始文件监控。
   * @param callback - 当文件事件发生时调用的回调函数。
   * @returns 返回一个函数，调用该函数可以停止监控。
   */
  public watchFile(callback: EventCallback): () => Promise<boolean> {
    const watcher = chokidar.watch(this.filePath, this.options);
    this.setupEventListeners(watcher, callback);

    let isWatching = true;

    return async (): Promise<boolean> => {
      if (!isWatching) {
        logger.warn(`监控器已经停止，无需重复操作`);
        return true;
      }

      logger.info(`正在停止对 ${this.filePath} 的监控...`);
      try {
        await watcher.close();
        isWatching = false;
        logger.info(`成功停止监控路径: ${this.filePath}`);
        return true;
      } catch (error) {
        logger.error(`关闭监控器时出错`, error);
        return false;
      }
    };
  }

  /**
   * @private
   * @method setupEventListeners
   * @description 封装事件监听器的设置逻辑。
   * @param watcher - chokidar的FSWatcher实例。
   * @param callback - 事件回调函数。
   */
  private setupEventListeners(watcher: FSWatcher, callback: EventCallback): void {
    const eventHandler = async (eventType: string, itemPath: string, isDirectory: boolean) => {
      // 对于 change 事件，检查是否是真正的内容变化
      if (eventType === "change") {
        try {
          const stats = await fs.stat(itemPath);
          
          // 比较 mtime 和 ctime：
          // - 如果 ctime > mtime，说明只有元数据变化（如硬链接、权限等）
          // - 如果 ctime == mtime，说明是内容变化
          const mtimeMs = Math.floor(stats.mtimeMs);
          const ctimeMs = Math.floor(stats.ctimeMs);
          
          if (ctimeMs > mtimeMs) {
            logger.debug(`忽略仅元数据变化的事件 (ctime=${ctimeMs} > mtime=${mtimeMs}): ${path.basename(itemPath)}`);
            return;
          }
        } catch {
          logger.debug(`获取文件状态失败，继续处理: ${itemPath}`);
        }
      }
      
      logger.debug(`文件监控事件: ${eventType}, 文件: ${path.basename(itemPath)}`);
      callback(eventType, { path: itemPath, filename: path.basename(itemPath), isDirectory });
    };

    watcher
      .on("add", (filePath) => {
        // 只处理文件，忽略文件夹
        eventHandler("add", filePath, false);
      })
      .on("change", (filePath) => {
        // 只处理文件变化
        eventHandler("change", filePath, false);
      })
      // addDir 事件不处理，让特殊文件夹由定时扫描处理
      .on("error", (error) => logger.error(`监控错误`, error))
      .on("ready", () => {
        logger.info("初始扫描完成，准备监控文件变化");
      });
  }
}
