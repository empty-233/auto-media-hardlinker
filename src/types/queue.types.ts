import { TaskStatus, Queue } from '@prisma/client';

/**
 * 刮削任务数据
 */
export interface ScrapingTaskData {
  filePath: string;
  fileName: string;
  isDirectory: boolean;
  priority?: number;
  maxRetries?: number;
}

/**
 * 任务结果
 */
export interface TaskResult {
  success: boolean;
  mediaId?: number;
  fileId?: number;
  error?: string;
  processingTime?: number;
  isNonRetryable?: boolean;
  isTimeout?: boolean;
}


/**
 * 队列配置
 */
export interface QueueConfig {
  concurrency: number;           // 并发工作进程数
  retryDelay: number;           // 重试基础延迟（毫秒）
  maxRetryDelay: number;        // 最大重试延迟（毫秒）
  defaultMaxRetries: number;    // 默认最大重试次数
  processingTimeout: number;    // 任务处理超时时间（毫秒）
  batchSize: number;           // 批量处理大小
  queuePollInterval: number;   // 队列轮询间隔（毫秒）
  errorRetryInterval: number;  // 错误重试间隔（毫秒）
  timeoutCleanupInterval: number; // 超时清理间隔（毫秒）
}

/**
 * 队列统计信息
 */
export interface QueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  canceled: number;
  total: number;
  averageProcessingTime?: number;
}

/**
 * 任务查询选项
 */
export interface TaskQueryOptions {
  status?: TaskStatus;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'priority' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 工作进程接口
 */
export interface ITaskWorker {
  start(): Promise<void>;
  stop(waitForTasks?: boolean): Promise<void>;
  isRunning(): boolean;
  updateConfig(newConfig: Partial<QueueConfig>, forceRestart?: boolean): Promise<void>;
}

/**
 * 队列管理器接口
 */
export interface IQueueManager {
  enqueue(taskData: ScrapingTaskData): Promise<number>;
  enqueueTasks(tasksData: ScrapingTaskData[]): Promise<number[]>;
  dequeue(): Promise<Queue | null>;
  getStats(): Promise<QueueStats>;
  getTasks(options?: TaskQueryOptions): Promise<{ items: Queue[]; total: number }>;
  retryTask(taskId: number): Promise<boolean>;
  retryAllFailedTasks(): Promise<number>;
  cancelTask(taskId: number): Promise<boolean>;
  clearFailedTasks(): Promise<number>;
}
