import { QueueManager } from "./queueManager";
import { TaskWorker, DEFAULT_QUEUE_CONFIG } from "./taskWorker";
import { logger } from "../utils/logger";
import { 
  ScrapingTaskData, 
  QueueConfig, 
  QueueStats, 
  TaskQueryOptions,
  IQueueManager 
} from "../types/queue.types";
import { Queue } from "@prisma/client";

/**
 * 队列服务 - 队列系统的主要入口点
 */
export class QueueService {
  private queueManager: QueueManager;
  private taskWorker: TaskWorker;
  private config: QueueConfig;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
    this.queueManager = new QueueManager();
    this.taskWorker = new TaskWorker(this.config);
  }

  /**
   * 启动队列服务
   */
  async start(): Promise<void> {
    try {
      logger.info('启动队列服务...');
      await this.taskWorker.start();
      logger.info('队列服务已启动');
    } catch (error) {
      logger.error('启动队列服务失败', error);
      throw error;
    }
  }

  /**
   * 停止队列服务
   */
  async stop(): Promise<void> {
    try {
      logger.info('停止队列服务...');
      await this.taskWorker.stop();
      logger.info('队列服务已停止');
    } catch (error) {
      logger.error('停止队列服务失败', error);
      throw error;
    }
  }

  /**
   * 检查服务是否在运行
   */
  isRunning(): boolean {
    return this.taskWorker.isRunning();
  }

  /**
   * 添加任务到队列
   */
  async enqueueTask(taskData: ScrapingTaskData): Promise<number> {
    return await this.queueManager.enqueue(taskData);
  }

  /**
   * 批量添加任务到队列
   */
  async enqueueTasks(tasksData: ScrapingTaskData[]): Promise<number[]> {
    try {
      return await this.queueManager.enqueueTasks(tasksData);
    } catch (error) {
      logger.error('批量添加任务失败', error);
      throw error;
    }
  }

  /**
   * 获取队列统计信息
   */
  async getStats(): Promise<QueueStats> {
    return await this.queueManager.getStats();
  }

  /**
   * 获取任务列表
   */
  async getTasks(options?: TaskQueryOptions): Promise<{
    items: Queue[];
    total: number;
  }> {
    return await this.queueManager.getTasks(options);
  }

  /**
   * 重试失败的任务
   */
  async retryTask(taskId: number): Promise<boolean> {
    return await this.queueManager.retryTask(taskId);
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: number): Promise<boolean> {
    return await this.queueManager.cancelTask(taskId);
  }

  /**
   * 清除所有失败的任务
   */
  async clearFailedTasks(): Promise<number> {
    return await this.queueManager.clearFailedTasks();
  }

  /**
   * 重试所有失败的任务
   */
  async retryAllFailedTasks(): Promise<number> {
    return await this.queueManager.retryAllFailedTasks();
  }

  /**
   * 更新队列配置
   */
  async updateConfig(newConfig: Partial<QueueConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    logger.info(`队列配置已更新: ${JSON.stringify(this.config)}`);
    
    // 同时更新 TaskWorker 的配置
    await this.taskWorker.updateConfig(newConfig);
  }

  /**
   * 获取当前配置
   */
  getConfig(): QueueConfig {
    return { ...this.config };
  }

  /**
   * 获取队列管理器实例（用于高级操作）
   */
  getQueueManager(): IQueueManager {
    return this.queueManager;
  }
}

// 全局队列服务实例
let globalQueueService: QueueService | null = null;

/**
 * 获取全局队列服务实例
 */
export function getQueueService(config?: Partial<QueueConfig>): QueueService {
  if (!globalQueueService) {
    globalQueueService = new QueueService(config);
  }
  return globalQueueService;
}

/**
 * 重置全局队列服务实例（主要用于测试）
 */
export function resetQueueService(): void {
  globalQueueService = null;
}
