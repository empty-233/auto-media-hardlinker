import { z } from 'zod';
import { CommonValidators, ParamValidators } from './common.validator';

/**
 * 剧集路径参数验证器
 * 
 * 用于验证剧集相关路由中的路径参数，如剧集ID、媒体ID、季号、集号等。
 * 继承通用参数验证逻辑，提供剧集特定的验证规则。
 */
export const EpisodeParamValidators = {
  /**
   * 剧集ID参数验证
   * 验证路径中的剧集ID参数
   * 
   * @example
   * // 路由: "/api/episodes/:id"
   * // 验证: { id: "123" } -> { id: 123 }
   */
  id: ParamValidators.id,

  /**
   * 媒体ID参数验证
   * 验证路径中的媒体ID参数
   * 
   * @example
   * // 路由: "/api/media/:mediaId/episodes"
   * // 验证: { mediaId: "456" } -> { mediaId: 456 }
   */
  mediaId: z.object({
    mediaId: CommonValidators.id
  }),

  /**
   * 季号和集号组合参数验证
   * 验证路径中的季号和集号参数
   * 
   * @example
   * // 路由: "/api/media/:mediaId/season/:season/episode/:episode"
   * // 验证: { mediaId: "123", season: "1", episode: "5" }
   */
  seasonEpisode: z.object({
    mediaId: CommonValidators.id,
    season: CommonValidators.validSeasonNumber,
    episode: CommonValidators.validEpisodeNumber
  })
};

/**
 * 剧集查询参数验证器
 * 
 * 用于验证剧集相关接口的查询参数，如分页、搜索、季数筛选等。
 * 结合通用查询参数验证，提供剧集特定的查询逻辑。
 */
export const EpisodeQueryValidators = {
  /**
   * 剧集列表查询参数
   * 包含分页、媒体ID、季数和集数筛选
   * 
   * @example
   * // 查询: "?mediaId=123&season=1&episode=5&page=1&limit=20"
   * // 验证后: { mediaId: 123, season: 1, episode: 5, page: 1, limit: 20 }
   */
  list: CommonValidators.pagination.extend({
    /** 媒体ID，用于筛选特定媒体的剧集 */
    mediaId: CommonValidators.id.optional(),
    /** 季号，用于筛选特定季的剧集 */
    season: CommonValidators.seasonNumber.optional(),
    /** 集号，用于筛选特定集 */
    episode: CommonValidators.episodeNumber.optional()
  }),

  /**
   * 剧集搜索查询参数
   * 专门用于搜索剧集功能的参数验证
   * 
   * @example
   * // 查询: "?query=第一集&mediaId=123&season=1"
   */
  search: CommonValidators.pagination.extend({
    /** 搜索查询词，可选 */
    query: CommonValidators.searchQuery.optional(),
    /** 媒体ID筛选，可选 */
    mediaId: CommonValidators.id.optional(),
    /** 季号筛选，可选 */
    season: CommonValidators.seasonNumber.optional()
  })
};
