import http from '@/utils/http'
import type { Media, MediaType, UpdateEpisodeParams, EpisodeInfo,MediaPaginationParams } from './types'
import type { PaginatedResponse } from '@/types/api'

/**
 * 媒体API服务
 */
export class MediaService {
  /**
   * 获取所有媒体列表
   */
  static async getAllMedia(
    params: MediaPaginationParams
  ): Promise<PaginatedResponse<Media>> {
    return http.get<PaginatedResponse<Media>>('/media', params)
  }

  /**
   * 获取单个媒体详情
   */
  static async getMediaById(id: number): Promise<Media> {
    return http.get<Media>(`/media/${id}`)
  }

  /**
   * 按类型获取媒体列表
   */
  static async getMediaByType(
    type: MediaType,
    params: MediaPaginationParams
  ): Promise<PaginatedResponse<Media>> {
    return http.get<PaginatedResponse<Media>>(`/media/type/${type}`, params)
  }

  /**
   * 更新剧集信息
   */
  static async updateEpisode(id: number, params: UpdateEpisodeParams): Promise<EpisodeInfo> {
    return http.put<EpisodeInfo>(`/episodes/${id}`, params)
  }
}
