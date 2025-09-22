import { z } from 'zod';
import { CommonValidators, ParamValidators } from './common.validator';

/**
 * 媒体路径参数验证器
 * 
 * 用于验证媒体相关路由中的路径参数，如媒体ID、媒体类型等。
 * 继承通用参数验证逻辑，提供媒体特定的验证规则。
 */
export const MediaParamValidators = {
  /**
   * 媒体ID参数验证
   * 验证路径中的媒体ID参数
   * 
   * @example
   * // 路由: "/api/media/:id"
   * // 验证: { id: "123" } -> { id: 123 }
   */
  id: ParamValidators.id,

  /**
   * 媒体类型参数验证
   * 验证路径中的媒体类型参数，限制为 movie 或 tv
   * 
   * @example
   * // 路由: "/api/media/:type"
   * // 验证: { type: "movie" } -> { type: "movie" }
   */
  type: z.object({
    type: CommonValidators.mediaType
  })
};

/**
 * 媒体查询参数验证器
 * 
 * 用于验证媒体相关接口的查询参数，如分页、搜索关键词、媒体类型筛选等。
 * 结合通用查询参数验证，提供媒体特定的查询逻辑。
 */
export const MediaQueryValidators = {
  /**
   * 媒体列表查询参数
   * 包含分页、搜索关键词和媒体类型筛选
   * 
   * @example
   * // 查询: "?page=2&limit=50&keyword=阿凡达&type=movie"
   * // 验证后: { page: 2, limit: 50, keyword: "阿凡达", type: "movie" }
   */
  list: CommonValidators.pagination.extend({
    /** 搜索关键词，用于模糊匹配媒体标题 */
    keyword: z.string().trim().optional(),
    /** 媒体类型筛选，可选择电影或电视剧 */
    type: CommonValidators.mediaType.optional()
  }),

  /**
   * 媒体搜索查询参数
   * 专门用于搜索功能的参数验证
   * 
   * @example
   * // 查询: "?query=阿凡达&page=1&limit=20"
   */
  search: CommonValidators.pagination.extend({
    /** 搜索查询词，必填 */
    query: CommonValidators.searchQuery,
    /** 媒体类型筛选，可选 */
    type: CommonValidators.mediaType.optional()
  })
};