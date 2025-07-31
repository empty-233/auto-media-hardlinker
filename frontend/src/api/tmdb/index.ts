import http from '@/utils/http'
import type { TMDBSearchResponse, TMDBSearchParams, TMDBInfoParams } from './types'
import type { MovieResponse, ShowResponse, TvSeasonResponse } from 'moviedb-promise'

/**
 * TMDB API服务
 */
export class TMDBService {
  /**
   * 搜索媒体内容（电影和电视剧）
   */
  static async searchMulti(params: TMDBSearchParams): Promise<TMDBSearchResponse> {
    return http.get<TMDBSearchResponse>('/tmdb/search/multi', params)
  }

  /**
   * 搜索电影
   */
  static async searchMovies(params: TMDBSearchParams): Promise<TMDBSearchResponse> {
    return http.get<TMDBSearchResponse>('/tmdb/search/movie', params)
  }

  /**
   * 搜索电视剧
   */
  static async searchTV(params: TMDBSearchParams): Promise<TMDBSearchResponse> {
    return http.get<TMDBSearchResponse>('/tmdb/search/tv', params)
  }

  /**
   * 获取电影详情
   */
  static async getMovieInfo(id: number, params?: TMDBInfoParams): Promise<MovieResponse> {
    return http.get<MovieResponse>(`/tmdb/movie/${id}`, params)
  }

  /**
   * 获取电视剧详情
   */
  static async getTvInfo(id: number, params?: TMDBInfoParams): Promise<ShowResponse> {
    return http.get<ShowResponse>(`/tmdb/tv/${id}`, params)
  }

  /**
   * 获取电视剧季详情
   */
  static async getSeasonInfo(
    id: number,
    season_number: number,
    params?: TMDBInfoParams
  ): Promise<TvSeasonResponse> {
    return http.get<TvSeasonResponse>(`/tmdb/tv/${id}/season/${season_number}`, params)
  }
}

export * from './types'
