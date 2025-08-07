import type { BasePaginationParams } from '@/types/api'

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED'
}

/**
 * 刮削任务
 */
export interface ScrapingTask {
  id: number
  filePath: string
  fileName: string
  isDirectory: boolean
  status: TaskStatus
  priority: number
  retryCount: number
  maxRetries: number
  lastError?: string
  result?: string
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  nextRetryAt?: string
}

/**
 * 队列统计信息
 */
export interface QueueStats {
  pending: number
  running: number
  completed: number
  failed: number
  canceled: number
  total: number
  averageProcessingTime?: number
}

/**
 * 队列配置
 */
export interface QueueConfig {
  concurrency: number
  retryDelay: number
  maxRetryDelay: number
  defaultMaxRetries: number
  processingTimeout: number
  batchSize: number
}

/**
 * 队列服务状态
 */
export interface QueueStatus {
  running: boolean
  stats: QueueStats
  config: QueueConfig
}

/**
 * 任务查询参数
 */
export interface TaskQueryParams extends BasePaginationParams {
  status?: TaskStatus
  sortBy?: 'createdAt' | 'priority' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}
