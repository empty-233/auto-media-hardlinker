import http from '@/utils/http'
import type { 
  ScanConfig,
  ScanStatus, 
  ScanLog, 
  LibraryFile, 
  GetScanLogsParams, 
  GetLibraryFilesParams 
} from './types'
import type { PaginatedResponse } from '@/types/api'

/**
 * 扫描管理API服务
 */
export class ScanService {
  /**
   * 获取扫描状态
   */
  static async getScanStatus(): Promise<ScanStatus> {
    return http.get<ScanStatus>('/scan/status')
  }

  /**
   * 触发扫描
   */
  static async triggerScan(): Promise<void> {
    return http.post<void>('/scan/trigger')
  }

  /**
   * 获取扫描日志
   */
  static async getScanLogs(params: GetScanLogsParams): Promise<PaginatedResponse<ScanLog>> {
    return http.get<PaginatedResponse<ScanLog>>('/scan/logs', params)
  }

  /**
   * 获取库文件列表
   */
  static async getLibraryFiles(params: GetLibraryFilesParams): Promise<PaginatedResponse<LibraryFile>> {
    return http.get<PaginatedResponse<LibraryFile>>('/scan/library', params)
  }

  /**
   * 重新处理文件
   */
  static async reprocessFile(fileId: number): Promise<void> {
    return http.put<void>(`/scan/library/${fileId}/reprocess`)
  }

  /**
   * 删除文件记录
   */
  static async deleteFile(fileId: number): Promise<void> {
    return http.delete<void>(`/scan/library/${fileId}`)
  }

  /**
   * 获取扫描配置
   */
  static async getScanConfig(): Promise<ScanConfig> {
    return http.get<ScanConfig>('/scan/config')
  }

  /**
   * 更新扫描配置
   */
  static async updateScanConfig(config: Partial<ScanConfig>): Promise<ScanConfig> {
    return http.put<ScanConfig>('/scan/config', config)
  }
}
