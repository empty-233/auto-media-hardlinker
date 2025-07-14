import type { Media, EpisodeInfo } from '../media/types'

/**
 * 文件信息接口
 */
export interface FileInfo {
  id: number
  deviceId: string
  inode: string
  fileHash: string
  fileSize: string
  filePath: string
  linkPath: string
  createdAt: string
  mediaId?: number
  Media?: Media
  episode?: EpisodeInfo
}
