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

/**
 * 获取日志查询参数
 */
export interface GetLogsParams {
  limit?: number
  level?: LogLevel | string
  keyword?: string
}
