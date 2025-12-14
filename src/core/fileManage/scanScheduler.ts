import { getConfig } from '../../config/config';
import { LibraryScanner } from './libraryScanner';
import { logger } from '../../utils/logger';
import { getContainer } from './container';
import { FileProcessor } from './fileProcessor';

/**
 * 定期扫描调度器
 */
export class ScanScheduler {
  private scanner: LibraryScanner;
  private fileProcessor: FileProcessor;
  private config = getConfig();
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.scanner = new LibraryScanner(prisma);
    const container = getContainer();
    this.fileProcessor = container.getFileProcessor();
  }

  /**
   * 启动定期扫描
   */
  start(): void {
    if (!this.config.scanConfig.enabled) {
      logger.info('定期扫描已禁用');
      return;
    }

    // 将分钟转换为毫秒
    const intervalMs = this.config.scanConfig.interval * 60 * 1000;
    
    if (intervalMs > 0) {
      this.intervalId = setInterval(async () => {
        await this.runScan();
      }, intervalMs);
      
      logger.info(`定期扫描已启动，间隔: ${this.config.scanConfig.interval}分钟 (${intervalMs}ms)`);
      
      setTimeout(async () => {
        await this.runScan();
      }, 5000);
    } else {
      logger.error(`无效的扫描间隔配置: ${this.config.scanConfig.interval}分钟`);
    }
  }

  /**
   * 停止定期扫描
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('定期扫描已停止');
    }
  }

  /**
   * 手动触发扫描
   */
  async triggerScan(): Promise<void> {
    await this.runScan();
  }

  /**
   * 检查是否正在扫描
   */
  isScanning(): boolean {
    return this.isRunning;
  }

  /**
   * 执行扫描
   */
  private async runScan(): Promise<void> {
    if (this.isRunning) {
      logger.warn('扫描已在进行中，跳过此次调度');
      return;
    }

    this.isRunning = true;
    logger.info('开始执行定期扫描');

    try {
      // 确保队列服务已启动，以便处理扫描发现的新文件
      await this.fileProcessor.ensureQueueService();

      const result = await this.scanner.scanAllLibraries();
      logger.info(`定期扫描完成: 发现 ${result.filesFound} 个文件，新增 ${result.filesAdded} 个，耗时 ${result.duration}ms`);
      
      if (result.errors.length > 0) {
        logger.warn(`扫描过程中发生 ${result.errors.length} 个错误`);
      }
    } catch (error) {
      logger.error('定期扫描失败', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 更新扫描配置
   */
  updateConfig(): void {
    // 重新加载配置
    this.config = getConfig(false); // 强制重新读取配置
    
    // 如果扫描配置发生变化，重启调度器
    if (this.intervalId) {
      this.stop();
      this.start();
    }
  }
}
