/**
 * 媒体类型统计
 */
export interface MediaTypeStats {
  movie: number
  tv: number
  collection: number
}

/**
 * 仪表板统计数据
 */
export interface DashboardStats {
  totalMedia: number
  totalFiles: number
  totalStorageBytes: number
  totalStorageGB: number
  totalStorageTB: number
  storageUsagePercent: number
  typeStats: MediaTypeStats
  recentMedia: RecentMedia[]
}

/**
 * 最近添加的媒体
 */
export interface RecentMedia {
  id: number
  title: string
  type: 'tv' | 'movie' | 'collection'
  releaseDate?: string
  posterUrl?: string
  createdAt: string
  _count: {
    files: number
  }
}

/**
 * 存储空间详细信息
 */
export interface StorageInfo {
  totalBytes: number
  totalGB: number
  totalTB: number
  byType: {
    movie: number
    tv: number
    collection: number
  }
}