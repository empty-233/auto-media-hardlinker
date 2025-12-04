import type { Media, EpisodeInfo } from '../media/types'

/**
 * 数据库文件信息接口
 */
export interface FileInfo {
  id: number
  deviceId: string
  inode: string
  fileHash: string | null
  fileSize: string
  filePath: string
  linkPath: string
  createdAt: string
  mediaId?: number
  Media?: Media
  episodeInfo?: EpisodeInfo
  // 文件/文件夹标识
  isDirectory?: boolean
  isSpecialFolder?: boolean
  folderType?: 'BDMV' | 'VIDEO_TS' | 'ISO' | null
  isMultiDisc?: boolean
  discNumber?: number | null
  // 父文件夹标识
  isParentFolder?: boolean
  parentFolderId?: number | null
  childFolders?: FileInfo[]
}

/**
 * 文件系统项目接口
 */
export interface FileSystemItem {
  name: string
  path: string
  fullPath: string
  isDirectory: boolean
  size?: number
  extension?: string
  modifiedTime: string
  inDatabase: boolean
  databaseRecord?: FileInfo
  navigationPath?: string
  // 特殊文件夹标识
  isSpecialFolder?: boolean
  folderType?: 'BDMV' | 'VIDEO_TS' | 'ISO' | null
  isMultiDisc?: boolean
  discNumber?: number | null
  // 父文件夹标识
  isParentFolder?: boolean
  parentFolderId?: number | null
  childFolders?: FileInfo[]
}

/**
 * 文件重命名参数
 */
export interface RenameFileParams {
  newName: string
}

/**
 * 父文件夹信息
 */
export interface ParentFolderInfo {
  id: number
  path: string
}

/**
 * 关联媒体参数
 */
export interface LinkMediaParams {
  mediaInfo: object
  filename?: string
  path?: string
  episodeTmdbId?: number
  seasonNumber?: number
  episodeNumber?: number
  isSpecialFolder?: boolean
  parentFolder?: ParentFolderInfo | null
}
