import { QueueManager } from "./queueManager";
import { TaskProcessor } from "./taskProcessor";
import { logger } from "@/utils/logger";
import { ITaskWorker, QueueConfig } from "@/types/queue.types";

/**
 * 任务工作进程 - 负责从队列中消费任务并处理
 */
export class TaskWorker implements ITaskWorker {
  private queueManager: QueueManager;
  private taskProcessor: TaskProcessor;
  private config: QueueConfig;
  private running: boolean = false;
  private processingPromises: Promise<void>[] = [];
  private stopRequested: boolean = false;

  constructor(config: QueueConfig) {
    this.queueManager = new QueueManager(config);
    this.taskProcessor = new TaskProcessor();
    this.config = config;
  }

  /**
   * 启动工作进程
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('工作进程已在运行中');
      return;
    }

    this.running = true;
    this.stopRequested = false;
    logger.info(`启动工作进程，并发数: ${this.config.concurrency}`);

    // 启动指定数量的工作协程
    for (let i = 0; i < this.config.concurrency; i++) {
      const workerPromise = this.workerLoop(i);
      this.processingPromises.push(workerPromise);
    }

    // 启动定期清理超时任务
    this.startTimeoutCleanup();
  }

  /**
   * 停止工作进程
   * @param waitForTasks 是否等待正在处理的任务完成，默认为true
   */
  async stop(waitForTasks: boolean = true): Promise<void> {
    if (!this.running) {
      return;
    }

    logger.info(`正在停止工作进程... (等待任务完成: ${waitForTasks})`);
    this.stopRequested = true;

    if (waitForTasks) {
      // 等待所有正在处理的任务完成
      await Promise.all(this.processingPromises);
    } else {
      // 强制停止，不等待任务完成
      logger.warn('强制停止工作进程，正在处理的任务将被中断');
    }

    this.running = false;
    this.processingPromises = [];
    logger.info('工作进程已停止');
  }

  /**
   * 检查工作进程是否在运行
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 更新配置（热更新）
   * @param newConfig 新的配置
   * @param forceRestart 是否强制重启队列，默认为false
   */
  async updateConfig(newConfig: Partial<QueueConfig>, forceRestart: boolean = false): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // 更新 QueueManager 的配置
    this.queueManager.updateConfig(this.config);

    logger.info(`TaskWorker 配置已更新: 旧配置=${JSON.stringify(oldConfig)}, 新配置=${JSON.stringify(this.config)}`);

    // 根据参数决定是否重启队列
    if (forceRestart && this.running) {
      logger.info(`配置变更，强制重启队列服务 (forceRestart=true)`);
      await this.forceRestart();
    } else if (!forceRestart && this.running) {
      logger.info(`配置已更新，队列等待运行完成后重启 (forceRestart=false)`);
      await this.stop();
      await this.start();
    }
  }

  /**
   * 强制重启队列服务 - 立即停止所有任务并重新启动
   */
  async forceRestart(): Promise<void> {
    if (!this.running) {
      return;
    }

    logger.info('强制重启队列服务 - 立即停止所有任务...');
    
    // 强制停止，不等待任务完成
    await this.stop(false);
    
    // 立即重新启动
    await this.start();
    
    logger.info('队列服务已强制重启');
  }

  /**
   * 工作循环 - 持续从队列中获取并处理任务
   */
  private async workerLoop(workerId: number): Promise<void> {
    logger.info(`工作协程 ${workerId} 已启动`);

    while (!this.stopRequested) {
      try {
        // 从队列中获取任务
        const task = await this.queueManager.dequeue();
        
        if (!task) {
          // 队列为空，等待一段时间后重试
          await this.sleep(this.config.queuePollInterval);
          continue;
        }

        logger.info(`工作协程 ${workerId} 开始处理任务: ${task.fileName} (ID: ${task.id})`);

        // 处理任务
        const result = await this.processTaskWithTimeout(task);

        // 根据处理结果更新任务状态
        if (result.success) {
          await this.queueManager.completeTask(task.id, result);
          logger.info(`工作协程 ${workerId} 完成任务: ${task.fileName} (ID: ${task.id})`);
        } else {
          if (result.isNonRetryable) {
            await this.queueManager.failTaskPermanently(task.id, result.error || '处理失败');
            logger.error(`工作协程 ${workerId} 任务永久失败: ${task.fileName} (ID: ${task.id}), 错误: ${result.error}`);
          } else if (result.isTimeout) {
            // 超时任务可能需要更长的重试间隔
            await this.queueManager.failTask(task.id, result.error || '处理超时');
            logger.warn(`工作协程 ${workerId} 任务超时: ${task.fileName} (ID: ${task.id}), 错误: ${result.error}`);
          } else {
            await this.queueManager.failTask(task.id, result.error || '处理失败');
            logger.error(`工作协程 ${workerId} 任务失败: ${task.fileName} (ID: ${task.id}), 错误: ${result.error}`);
          }
        }

      } catch (error: any) {
        logger.error(`工作协程 ${workerId} 发生未预期错误`, error);
        // 等待一段时间后继续
        await this.sleep(this.config.errorRetryInterval);
      }
    }

    logger.info(`工作协程 ${workerId} 已停止`);
  }

  /**
   * 带超时控制的任务处理
   */
  private async processTaskWithTimeout(task: any): Promise<any> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          error: `任务处理超时 (${this.config.processingTimeout}ms)`,
          isTimeout: true
        });
      }, this.config.processingTimeout);

      this.taskProcessor.processTask(task)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          resolve({
            success: false,
            error: error.message || '任务处理异常'
          });
        });
    });
  }

  /**
   * 启动定期清理超时任务
   */
  private startTimeoutCleanup(): void {
    const cleanupInterval = setInterval(async () => {
      if (this.stopRequested) {
        clearInterval(cleanupInterval);
        return;
      }

      try {
        await this.queueManager.cleanupTimeoutTasks(this.config.processingTimeout);
      } catch (error) {
        logger.error('清理超时任务失败', error);
      }
    }, this.config.timeoutCleanupInterval);
  }

  /**
   * 休眠指定毫秒数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 默认队列配置
 */
export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  concurrency: 1,                // 默认单线程处理
  retryDelay: 1000,             // 1秒基础重试延迟
  maxRetryDelay: 300000,        // 5分钟最大重试延迟
  defaultMaxRetries: 3,         // 默认最大重试3次
  processingTimeout: 300000,    // 5分钟处理超时
  batchSize: 10,               // 批量处理大小
  queuePollInterval: 1000,     // 1秒队列轮询间隔
  errorRetryInterval: 5000,    // 5秒错误重试间隔
  timeoutCleanupInterval: 60000 // 1分钟超时清理间隔
};
