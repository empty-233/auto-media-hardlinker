import type { BasePaginationParams } from '@/types/api'
/**
 * 媒体类型枚举
 */
export enum MediaType {
  TV = 'tv',
  MOVIE = 'movie', 
  COLLECTION = 'collection'
}

/**
 * 媒体信息接口
 */
export interface Media {
  id: number
  type: MediaType
  tmdbId: number
  title: string
  originalTitle?: string
  releaseDate?: string
  description?: string
  posterUrl?: string
  backdropUrl?: string
  createdAt: string
  updatedAt: string
  files: MediaFile[]
  tvInfos?: TvInfo[]
  movieInfo?: MovieInfo
  collectionInfo?: CollectionInfo
}

/**
 * 媒体文件接口
 */
export interface MediaFile {
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
  // 文件/文件夹标识
  isDirectory?: boolean
  isSpecialFolder?: boolean
  folderType?: 'BDMV' | 'VIDEO_TS' | 'ISO' | null
  isMultiDisc?: boolean
  discNumber?: number | null
}

/**
 * 电视剧信息接口
 */
export interface TvInfo {
  id: number
  tmdbId: number
  description?: string
  episodes: EpisodeInfo[]
}

/**
 * 剧集信息接口
 */
export interface EpisodeInfo {
  id: number
  tmdbId: number
  seasonNumber: number
  episodeNumber: number
  title?: string
  releaseDate?: string
  description?: string
  posterUrl?: string
  tvInfoId?: number
  fileId?: number
}

/**
 * 电影信息接口
 */
export interface MovieInfo {
  id: number
  tmdbId: number
  description?: string
}

/**
 * 合集信息接口
 */
export interface CollectionInfo {
  id: number
  tmdbId: number
  description?: string
}

/**
 * 更新剧集请求参数
 */
export interface UpdateEpisodeParams {
  title?: string
  description?: string
  episodeNumber?: number
}

/**
 * 媒体分页查询参数
 */
export interface MediaPaginationParams extends BasePaginationParams {
  keyword?: string
}
