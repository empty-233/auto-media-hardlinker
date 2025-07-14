import http from '@/utils/http'
import type { LogEntry, GetLogsParams } from './types'

/**
 * 日志API服务
 */
export class LogService {
  /**
   * 获取系统日志
   */
  static async getLogs(params: GetLogsParams): Promise<LogEntry[]> {
    return http.get<LogEntry[]>('/logs', params)
  }
}
