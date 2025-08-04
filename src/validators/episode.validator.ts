import { z } from 'zod';
import { CommonValidators } from './common.validator';

/**
 * 剧集相关的验证器
 */
export const EpisodeValidators = {
  /**
   * 更新剧集请求体验证
   */
  updateEpisode: z.object({
    title: CommonValidators.title.optional(),
    description: CommonValidators.description.optional(),
    episodeNumber: z.coerce.number().int().min(0, '剧集编号不能小于0').optional()
  }).refine(
    (data) => {
      // 至少要更新一个字段
      return data.title !== undefined || data.description !== undefined || data.episodeNumber !== undefined;
    },
    {
      message: '至少需要提供一个要更新的字段',
      path: ['title', 'description', 'episodeNumber']
    }
  ),

  /**
   * 同步剧集请求体验证
   */
  syncEpisodes: z.object({
    tmdbId: CommonValidators.tmdbId,
    seasonNumber: CommonValidators.validSeasonNumber,
    forceSync: z.boolean().default(false).optional()
  }),

  /**
   * 查询剧集参数验证
   */
  findEpisode: z.object({
    tmdbId: CommonValidators.tmdbId,
    seasonNumber: CommonValidators.validSeasonNumber,
    episodeNumber: CommonValidators.validEpisodeNumber
  }),

  /**
   * 批量更新剧集验证
   */
  batchUpdateEpisodes: z.object({
    episodes: z.array(
      z.object({
        id: CommonValidators.tmdbId,
        title: CommonValidators.title.optional(),
        description: CommonValidators.description.optional(),
        episodeNumber: z.number().int().min(1, '集号必须是大于等于1的整数').optional()
      })
    ).min(1, '至少需要更新一个剧集').max(100, '单次最多更新100个剧集')
  })
};

/**
 * 剧集相关的路径参数验证器
 */
export const EpisodeParamValidators = {
  /**
   * 剧集ID路径参数验证
   */
  episodeId: z.object({
    id: CommonValidators.id
  }),

  /**
   * TMDB ID路径参数验证
   */
  tmdbId: z.object({
    tmdbId: CommonValidators.id
  }),

  /**
   * 季和集路径参数验证
   */
  seasonAndEpisode: z.object({
    tmdbId: CommonValidators.id,
    seasonNumber: CommonValidators.id,
    episodeNumber: CommonValidators.id
  })
};

/**
 * 剧集相关的查询参数验证器
 */
export const EpisodeQueryValidators = {
  /**
   * 获取剧集列表查询参数
   */
  getEpisodesList: z.object({
    tmdbId: z.coerce.number().int().positive('TMDB ID必须是正整数'),
    seasonNumber: z.coerce.number().int().positive('季号必须是正整数').optional(),
    page: z.coerce.number().int().min(1, 'page必须是正整数').default(1),
    limit: z.coerce.number().int().min(1, 'limit必须是正整数').max(100, 'limit不能超过100').default(20)
  }),

  /**
   * 搜索剧集查询参数
   */
  searchEpisodes: z.object({
    q: CommonValidators.searchQuery,
    tmdbId: z.coerce.number().int().positive().optional(),
    seasonNumber: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().min(1, 'page必须是正整数').default(1),
    limit: z.coerce.number().int().min(1, 'limit必须是正整数').max(50, 'limit不能超过50').default(10)
  })
};

/**
 * 剧集数据模型验证器
 */
export const EpisodeModelValidators = {
  /**
   * 剧集基础信息验证
   */
  episodeInfo: z.object({
    id: z.number().int().positive(),
    tmdbId: CommonValidators.tmdbId,
    seasonNumber: z.number().int().min(1),
    episodeNumber: z.number().int().min(1),
    title: CommonValidators.title,
    description: CommonValidators.description,
    airDate: z.date().nullable(),
    stillPath: CommonValidators.url,
    runtime: z.number().int().min(0).nullable(),
    voteAverage: z.number().min(0).max(10).nullable(),
    voteCount: z.number().int().min(0).nullable()
  }),

  /**
   * 剧集创建数据验证
   */
  episodeCreate: z.object({
    tmdbId: CommonValidators.tmdbId,
    seasonNumber: z.number().int().min(1),
    episodeNumber: z.number().int().min(1),
    title: CommonValidators.title,
    description: CommonValidators.description.default(null),
    airDate: z.date().nullable().default(null),
    stillPath: CommonValidators.url.default(null),
    runtime: z.number().int().min(0).nullable().default(null),
    voteAverage: z.number().min(0).max(10).nullable().default(null),
    voteCount: z.number().int().min(0).nullable().default(null)
  })
};
