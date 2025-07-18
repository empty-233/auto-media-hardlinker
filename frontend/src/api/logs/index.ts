import http from '@/utils/http'
import type { LogEntry, GetLogsParams } from './types'
import type { PaginatedResponse } from '@/types/api'

/**
 * 日志API服务
 */
export class LogService {
  /**
   * 获取系统日志
   */
  static async getLogs(params: GetLogsParams): Promise<PaginatedResponse<LogEntry>> {
    return http.get<PaginatedResponse<LogEntry>>('/logs', params)
  }
}
