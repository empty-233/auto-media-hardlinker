import chokidar from "chokidar";
import fs from "fs";
import path from "path";

/**
 * 文件监控器配置选项
 */
export interface FileMonitorOptions {
  /** 是否持久化监控 */
  persistent?: boolean;
  /** 监控深度，仅在recursive为true时有效 */
  depth?: number;
  /** 是否轮询 */
  usePolling?: boolean;
  /** 是否忽略初始文件扫描事件 */
  ignoreInitial?: boolean;
  /** 要忽略的文件/目录模式 */
  ignored?: RegExp | string | Array<RegExp | string>;
}

export class fileMonitor {
  private filePath: string;
  private options: FileMonitorOptions;
  constructor(filePath: string, options: FileMonitorOptions) {
    this.filePath = filePath;

    this.options = {
      persistent: true,
      ignoreInitial: true,
      ...options,
    };

    // 检测路径是否存在
    if (!fs.existsSync(this.filePath)) {
      console.warn(`该路径不存在: ${this.filePath}`);
    }
  }

  watchFile(callback: (eventType: string, fileInfo: { path: string, filename: string, isDirectory: boolean }) => void) {
    const watcher = chokidar.watch(this.filePath, this.options);
    let isWatching = true;

    // 监听所有事件类型
    watcher.on("add", (filePath) => callback("add", { path: filePath, filename: path.basename(filePath), isDirectory: false }));
    watcher.on("change", (filePath) => callback("change", { path: filePath, filename: path.basename(filePath), isDirectory: false }));
    watcher.on("unlink", (filePath) => callback("unlink", { path: filePath, filename: path.basename(filePath), isDirectory: false }));
    watcher.on("addDir", (dirPath) => callback("addDir", { path: dirPath, filename: path.basename(dirPath), isDirectory: true }));
    watcher.on("unlinkDir", (dirPath) => callback("unlinkDir", { path: dirPath, filename: path.basename(dirPath), isDirectory: true }));
    watcher.on("error", (error) => console.error(`监控错误: ${error}`));
    watcher.on("ready", () => console.log("初始扫描完成，准备监控文件变化"));

    /**
     * 停止文件监控
     * @returns 返回Promise，表示监控停止的结果
     */
    return async (): Promise<boolean> => {
      if (!isWatching) {
        console.log(`监控器已经停止，无需重复操作`);
        return true;
      }

      console.log(`正在停止对 ${this.filePath} 的监控...`);

      try {
        await watcher.close();
        isWatching = false;
        console.log(`成功停止监控路径: ${this.filePath}`);
        return true;
      } catch (error) {
        console.error(
          `关闭监控器时出错: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return false;
      }
    };
  }
}
