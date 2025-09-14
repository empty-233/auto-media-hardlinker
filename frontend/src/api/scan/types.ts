export interface ScanConfig {
  enabled: boolean
  interval: number // 间隔时间(分钟)
  concurrency: number
}

export interface ScanStatus {
  isScanning: boolean
  stats: {
    total: number
    videoCount: number
    subtitleCount: number
    pending: number
    processed: number
    error: number
    ignored: number
  }
}

export interface ScanLog {
  id: number
  scanTime: string
  scanPath: string
  filesFound: number
  filesAdded: number
  duration: number
  errors: string[]
  status: string
  createdAt: string
}

export interface LibraryFile {
  id: number
  type: string
  path: string
  size: number
  status: string
  lastProcessedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface GetScanLogsParams {
  page?: number
  limit?: number
  sortBy?: 'scanTime' | 'duration' | 'filesFound' | 'filesAdded'
  sortOrder?: 'asc' | 'desc'
}

export interface GetLibraryFilesParams {
  page?: number
  limit?: number
  type?: string
  status?: string
}
