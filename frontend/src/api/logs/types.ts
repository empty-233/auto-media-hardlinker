/**
 * 日志级别枚举
 */
export enum LogLevel {
  INFO = 'INFO',
  WARNING = 'WARNING', 
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

/**
 * 日志条目接口
 */
export interface LogEntry {
  id: number
  timestamp: string
  level: LogLevel
  message: string
  details?: any
}

import type { BasePaginationParams } from '@/types/api'

/**
 * 获取日志查询参数
 */
export interface GetLogsParams extends BasePaginationParams {
  level?: LogLevel | string
  keyword?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}
