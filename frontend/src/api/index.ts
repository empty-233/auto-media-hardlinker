import axios from 'axios'

const apiClient = axios.create({
  baseURL: 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

// 定义API服务器基础URL，用于图片资源
const API_BASE_URL = 'http://localhost:4000';

/**
 * 处理图片URL，确保它是完整的URL或者正确的相对路径
 * @param url 原始图片URL
 * @returns 处理后的图片URL
 */
export function getImageUrl(url: string | undefined | null): string {
  if (!url) {
    // 默认图片
    return 'https://via.placeholder.com/300x450?text=No+Poster';
  }
  
  // 检查是否已经是绝对URL（以http或https开头）
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // 检查是否是以斜杠开头的相对路径
  if (url.startsWith('/')) {
    return `${API_BASE_URL}${url}`;
  }
  
  // 默认加上API基础URL和斜杠
  return `${API_BASE_URL}/${url}`;
}

export interface Media {
  id: number
  type: 'tv' | 'movie' | 'collection'
  tmdbId: number
  title: string
  originalTitle?: string
  releaseDate?: string
  description?: string
  posterUrl?: string
  files: File[]
  tvInfos?: TvInfo
  movieInfo?: MovieInfo
  collectionInfo?: CollectionInfo
  createdAt: string
  updatedAt: string
}

export interface File {
  id: number
  deviceId: string
  inode: string
  fileHash: string
  fileSize: string
  filePath: string
  linkPath: string
  createdAt: string
  Media?: Media
  mediaId?: number
  episode?: EpisodeInfo
}

export interface TvInfo {
  id: number
  tmdbId: number
  description?: string
  episodes: EpisodeInfo[]
}

export interface MovieInfo {
  id: number
  tmdbId: number
  description?: string
}

export interface CollectionInfo {
  id: number
  tmdbId: number
  description?: string
}

export interface EpisodeInfo {
  id: number
  tmdbId: number
  episodeNumber: number
  title?: string
  releaseDate?: string
  description?: string
  posterUrl?: string
  tvInfoId?: number
  fileId?: number
}

export interface LogEntry {
  id: number
  timestamp: string
  level: string
  message: string
}

// 系统配置接口
export interface SystemConfig {
  useLlm: boolean;
  llmHost: string;
  llmModel: string;
}

export const api = {
  // 媒体相关API
  getAllMedia: () => apiClient.get<Media[]>('/media'),
  getMediaById: (id: number) => apiClient.get<Media>(`/media/${id}`),
  getMediaByType: (type: 'tv' | 'movie' | 'collection') => apiClient.get<Media[]>(`/media/type/${type}`),
  
  // 剧集相关API
  updateEpisode: (id: number, data: {title?: string, description?: string, episodeNumber?: number}) => 
    apiClient.put<EpisodeInfo>(`/episodes/${id}`, data),
  
  // 文件相关API
  getAllFiles: () => apiClient.get<File[]>('/files'),
  getFileById: (id: number) => apiClient.get<File>(`/files/${id}`),
  
  // 日志相关API
  getLogs: (limit?: number) => {
    const params = limit ? { limit } : {}
    return apiClient.get<LogEntry[]>('/logs', { params })
  },
  
  // 配置相关API
  getSystemConfig: () => apiClient.get<SystemConfig>('/config'),
  updateSystemConfig: (config: Partial<SystemConfig>) => apiClient.put<SystemConfig>('/config', config)
}