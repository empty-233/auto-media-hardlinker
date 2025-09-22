import { z } from 'zod';
import { CommonValidators } from './common.validator';

/**
 * TMDB路径参数验证器
 * 
 * 用于验证TMDB相关路由中的路径参数，如TMDB ID、季号等。
 * 继承通用参数验证逻辑，提供TMDB特定的验证规则。
 */
export const TMDBParamValidators = {
  /**
   * TMDB媒体ID参数验证
   * 验证路径中的TMDB媒体ID参数
   * 
   * @example
   * // 路由: "/api/tmdb/movie/:id"
   * // 验证: { id: "550" } -> { id: 550 }
   */
  id: z.object({
    id: CommonValidators.tmdbId
  }),

  /**
   * TMDB电视剧季参数验证
   * 验证路径中的TMDB电视剧ID和季号参数
   * 
   * @example
   * // 路由: "/api/tmdb/tv/:id/season/:season_number"
   * // 验证: { id: "1399", season_number: "1" }
   */
  tvSeason: z.object({
    id: CommonValidators.tmdbId,
    season_number: CommonValidators.validSeasonNumber
  })
};

/**
 * TMDB查询参数验证器
 * 
 * 用于验证TMDB API相关接口的查询参数，如搜索、语言、分页等。
 * 结合通用查询参数验证，提供TMDB API特定的查询逻辑。
 */
export const TMDBQueryValidators = {
  /**
   * TMDB搜索查询参数
   * 验证TMDB搜索API的通用参数，适用于多类型搜索
   * 
   * @example
   * // 查询: "?query=阿凡达&page=1&language=zh-CN&include_adult=false"
   * // 验证后: { query: "阿凡达", page: 1, language: "zh-CN", include_adult: false }
   */
  search: z.object({
    /** 搜索关键词，必填 */
    query: CommonValidators.searchQuery,
    /** 页码，自动转换为数字，默认第1页 */
    page: z.coerce.number().int().min(1, '页码必须大于0').default(1),
    /** 语言代码，默认中文简体 */
    language: CommonValidators.languageCode,
    /** 是否包含成人内容，默认false */
    include_adult: z.coerce.boolean().default(false)
  }),

  /**
   * TMDB电影搜索查询参数
   * 验证TMDB电影搜索API的参数，支持按年份筛选
   * 
   * @example
   * // 查询: "?query=搏击俱乐部&year=1999&primary_release_year=1999"
   */
  searchMovies: z.object({
    /** 搜索关键词，必填 */
    query: CommonValidators.searchQuery,
    /** 页码，自动转换为数字，默认第1页 */
    page: z.coerce.number().int().min(1, '页码必须大于0').default(1),
    /** 语言代码，默认中文简体 */
    language: CommonValidators.languageCode,
    /** 是否包含成人内容，默认false */
    include_adult: z.coerce.boolean().default(false),
    /** 发布年份，可选 */
    year: CommonValidators.year,
    /** 主要发布年份，可选 */
    primary_release_year: CommonValidators.year
  }),

  /**
   * TMDB电视剧搜索查询参数
   * 验证TMDB电视剧搜索API的参数，支持按首播年份筛选
   * 
   * @example
   * // 查询: "?query=权力的游戏&first_air_date_year=2011"
   */
  searchTV: z.object({
    /** 搜索关键词，必填 */
    query: CommonValidators.searchQuery,
    /** 页码，自动转换为数字，默认第1页 */
    page: z.coerce.number().int().min(1, '页码必须大于0').default(1),
    /** 语言代码，默认中文简体 */
    language: CommonValidators.languageCode,
    /** 是否包含成人内容，默认false */
    include_adult: z.coerce.boolean().default(false),
    /** 首播年份，可选 */
    first_air_date_year: CommonValidators.year
  }),

  /**
   * TMDB详情查询参数
   * 验证获取TMDB媒体详情时的查询参数
   * 
   * @example
   * // 查询: "?language=zh-CN&append_to_response=credits,videos"
   */
  details: z.object({
    /** 语言代码，默认中文简体 */
    language: CommonValidators.languageCode,
    /** 附加响应字段，可选 */
    append_to_response: z.string().optional()
  })
};
