/**
 * TMDB媒体类型
 */
export enum TMDBMediaType {
  MOVIE = 'movie',
  TV = 'tv'
}

/**
 * TMDB搜索结果项
 */
export interface TMDBSearchItem {
  id: number
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  release_date?: string
  first_air_date?: string
  overview?: string
  poster_path?: string
  backdrop_path?: string
  media_type?: TMDBMediaType
  vote_average?: number
  vote_count?: number
}

/**
 * TMDB搜索响应
 */
export interface TMDBSearchResponse {
  page: number
  results: TMDBSearchItem[]
  total_pages: number
  total_results: number
}

/**
 * TMDB搜索参数
 */
export interface TMDBSearchParams {
  query: string
  page?: number
  language?: string
  include_adult?: boolean
  year?: number
  primary_release_year?: number
  first_air_date_year?: number
}

/**
 * TMDB详情请求参数
 */
export interface TMDBInfoParams {
  language?: string
  append_to_response?: string
}
