import http from '@/utils/http'
import type { DashboardStats, RecentMedia, StorageInfo } from './types'

/**
 * 仪表板API服务
 */
export class DashboardService {
  /**
   * 获取仪表板统计信息
   */
  static async getDashboardStats(): Promise<DashboardStats> {
    return http.get<DashboardStats>('/dashboard/getDashboardStats')
  }

  /**
   * 获取最近添加的媒体
   * @param limit 限制返回数量，默认10
   */
  static async getRecentMedia(limit: number = 10): Promise<RecentMedia[]> {
    return http.get<RecentMedia[]>(`/recent-media?limit=${limit}`)
  }

  /**
   * 获取存储空间详细信息
   */
  static async getStorageInfo(): Promise<StorageInfo> {
    return http.get<StorageInfo>('/storage-info')
  }
}