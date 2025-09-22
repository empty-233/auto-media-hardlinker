import { z } from 'zod';
import { CommonValidators } from './common.validator';

/**
 * 仪表板查询参数验证器
 * 
 * 用于验证仪表板相关接口的查询参数，如统计数据查询、图表数据等。
 * 结合通用查询参数验证，提供仪表板特定的查询逻辑。
 */
export const DashboardQueryValidators = {
  /**
   * 仪表板统计数据查询参数
   * 用于获取仪表板概览统计信息
   * 
   * @example
   * // 查询: "?timeRange=week&includeDetails=true&mediaType=movie"
   * // 验证后: { timeRange: "week", includeDetails: true, mediaType: "movie" }
   */
  stats: z.object({
    /** 时间范围筛选 */
    timeRange: z.enum(['today', 'week', 'month', 'quarter', 'year']).default('week'),
    /** 是否包含详细信息 */
    includeDetails: z.coerce.boolean().default(false),
    /** 媒体类型筛选，可选 */
    mediaType: CommonValidators.mediaType.optional(),
    /** 是否包含趋势数据 */
    includeTrends: z.coerce.boolean().default(false)
  }),

  /**
   * 最近活动查询参数
   * 用于获取最近的系统活动和媒体更新
   * 
   * @example
   * // 查询: "?limit=20&type=media&days=7"
   */
  recentActivity: z.object({
    /** 返回结果数量限制 */
    limit: z.coerce.number().int().min(1, '数量限制必须大于0').max(100, '数量限制不能超过100').default(20),
    /** 活动类型筛选 */
    type: z.enum(['all', 'media', 'scan', 'queue', 'system']).default('all'),
  }),
};