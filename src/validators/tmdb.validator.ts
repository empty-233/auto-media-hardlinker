import { z } from 'zod';
import { CommonValidators } from './common.validator';

/**
 * TMDB (The Movie Database) API 相关的验证器
 * 
 * 包含所有与TMDB API交互相关的验证规则，如搜索电影、电视剧，
 * 获取详情、发现内容等。这些验证器确保发送给TMDB API的请求
 * 参数符合其要求，并使用 z.coerce 简化类型转换。
 */
export const TMDBValidators = {
  /**
   * 多类型搜索验证
   * 
   * 验证TMDB多类型搜索API的参数，可以同时搜索电影、电视剧和人物。
   * 使用 z.coerce 自动转换页码参数，并设置合理的默认值。
   * 
   * @example
   * // 搜索请求示例
   * {
   *   "query": "复仇者联盟",
   *   "page": "1",
   *   "language": "zh-CN",
   *   "include_adult": "false"
   * }
   */
  searchMulti: z.object({
    /** 搜索关键词 */
    query: CommonValidators.searchQuery,
    /** 页码，自动转换为数字，范围1-1000，默认第1页 */
    page: z.coerce.number().int().min(1).max(1000).default(1),
    /** 语言代码，用于本地化结果 */
    language: CommonValidators.languageCode,
    /** 是否包含成人内容，自动转换为布尔值，默认false */
    include_adult: CommonValidators.boolean.default(false)
  }),

  /**
   * 搜索电影验证
   * 
   * 验证TMDB电影搜索API的参数，支持按年份精确搜索。
   * 提供发布年份和主要发布年份两种年份筛选方式。
   * 
   * @example
   * // 电影搜索请求示例
   * {
   *   "query": "搏击俱乐部",
   *   "page": "1",
   *   "language": "zh-CN",
   *   "year": "1999",
   *   "include_adult": "false"
   * }
   */
  searchMovies: z.object({
    /** 搜索关键词 */
    query: CommonValidators.searchQuery,
    /** 页码，自动转换为数字，范围1-1000，默认第1页 */
    page: z.coerce.number().int().min(1).max(1000).default(1),
    /** 语言代码 */
    language: CommonValidators.languageCode,
    /** 是否包含成人内容，默认false */
    include_adult: CommonValidators.boolean.default(false),
    /** 发布年份，可选 */
    year: CommonValidators.year.optional(),
    /** 主要发布年份，可选 */
    primary_release_year: CommonValidators.year.optional()
  }),

  /**
   * 搜索电视剧验证
   * 
   * 验证TMDB电视剧搜索API的参数，支持按首播年份筛选。
   * 
   * @example
   * // 电视剧搜索请求示例
   * {
   *   "query": "权力的游戏",
   *   "page": "1",
   *   "language": "zh-CN",
   *   "first_air_date_year": "2011"
   * }
   */
  searchTV: z.object({
    /** 搜索关键词 */
    query: CommonValidators.searchQuery,
    /** 页码，自动转换为数字，范围1-1000，默认第1页 */
    page: z.coerce.number().int().min(1).max(1000).default(1),
    /** 语言代码 */
    language: CommonValidators.languageCode,
    /** 是否包含成人内容，默认false */
    include_adult: CommonValidators.boolean.default(false),
    /** 首播年份，可选 */
    first_air_date_year: CommonValidators.year.optional()
  }),

  /**
   * 获取电影详情验证
   * 
   * 验证获取TMDB电影详细信息的参数。需要电影ID，
   * 可选择语言和附加信息字段。
   * 
   * @example
   * // 获取电影详情请求示例
   * {
   *   "movie_id": "550",
   *   "language": "zh-CN",
   *   "append_to_response": "credits,videos,images"
   * }
   */
  getMovieDetails: z.object({
    /** TMDB电影ID */
    movie_id: CommonValidators.tmdbId,
    /** 语言代码，可选 */
    language: CommonValidators.languageCode.optional(),
    append_to_response: z.string().optional()
  }),

  /**
   * 获取电视剧详情验证
   */
  getTVDetails: z.object({
    tv_id: CommonValidators.tmdbId,
    language: CommonValidators.languageCode.optional(),
    append_to_response: z.string().optional()
  }),

  /**
   * 获取电视剧季详情验证
   */
  getTVSeasonDetails: z.object({
    tv_id: CommonValidators.tmdbId,
    season_number: z.coerce.number().int().min(0),
    language: CommonValidators.languageCode.optional()
  }),

  /**
   * 获取电视剧集详情验证
   */
  getTVEpisodeDetails: z.object({
    tv_id: CommonValidators.tmdbId,
    season_number: z.coerce.number().int().min(0),
    episode_number: z.coerce.number().int().min(1),
    language: CommonValidators.languageCode.optional()
  }),

  /**
   * 获取热门内容验证
   */
  getTrending: z.object({
    media_type: z.enum(['all', 'movie', 'tv', 'person'], {
      message: '媒体类型必须是all、movie、tv或person之一'
    }),
    time_window: z.enum(['day', 'week'], {
      message: '时间窗口必须是day或week'
    }),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    language: CommonValidators.languageCode.optional()
  }),

  /**
   * 发现内容验证
   */
  discover: z.object({
    media_type: CommonValidators.mediaType,
    page: z.coerce.number().int().min(1).max(1000).default(1),
    language: CommonValidators.languageCode,
    sort_by: z.string().default('popularity.desc'),
    include_adult: CommonValidators.boolean.default(false),
    include_video: CommonValidators.boolean.default(false),
    with_genres: z.string().optional(),
    without_genres: z.string().optional(),
    year: CommonValidators.year.optional(),
    'primary_release_date.gte': z.iso.date().optional(),
    'primary_release_date.lte': z.iso.date().optional(),
    'vote_average.gte': z.coerce.number().min(0).max(10).optional(),
    'vote_average.lte': z.coerce.number().min(0).max(10).optional(),
    'vote_count.gte': z.coerce.number().int().min(0).optional()
  })
};

/**
 * TMDB 路径参数验证器
 */
export const TMDBParamValidators = {
  /**
   * 电影ID路径参数验证
   */
  movieId: z.object({
    id: CommonValidators.tmdbId
  }),

  /**
   * 电视剧ID路径参数验证
   */
  tvId: z.object({
    id: CommonValidators.tmdbId
  }),

  /**
   * 电视剧季路径参数验证
   */
  tvSeason: z.object({
    id: CommonValidators.tmdbId,
    season_number: CommonValidators.id
  }),

  /**
   * 电视剧集路径参数验证
   */
  tvEpisode: z.object({
    id: CommonValidators.tmdbId,
    season_number: CommonValidators.id,
    episode_number: CommonValidators.id
  })
};

/**
 * TMDB 查询参数验证器
 */
export const TMDBQueryValidators = {
  /**
   * 基础搜索查询参数
   */
  search: z.object({
    query: CommonValidators.searchQuery,
    page: z.coerce.number().int().min(1).max(1000).default(1),
    language: CommonValidators.languageCode,
    include_adult: CommonValidators.boolean.default(false)
  }),

  /**
   * 详情查询参数
   */
  details: z.object({
    language: CommonValidators.languageCode.optional(),
    append_to_response: z.string().optional()
  }),

  /**
   * 发现查询参数
   */
  discover: z.object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    language: CommonValidators.languageCode,
    sort_by: z.string().default('popularity.desc'),
    include_adult: CommonValidators.boolean.default(false)
  })
};
