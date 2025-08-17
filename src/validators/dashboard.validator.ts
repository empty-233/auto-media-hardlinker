import { z } from 'zod';
import { CommonValidators } from './common.validator';

/**
 * 仪表板相关验证器
 */
export const DashboardValidators = {
  /**
   * 获取仪表板统计信息验证
   */
  getDashboardStats: z.object({
    timeRange: z.enum(['day', 'week', 'month', 'year'], {
      message: '时间范围必须是day、week、month或year之一'
    }).default('week'),
    includeDetails: CommonValidators.boolean.default(false)
  }),

  /**
   * 获取最近媒体验证
   */
  getRecentMedia: z.object({
    limit: z.coerce.number().int().min(1).max(100, 'limit不能超过100').default(10),
    type: CommonValidators.mediaType.optional(),
    days: z.coerce.number().int().min(1).max(365, '天数不能超过365天').default(7)
  }),

  /**
   * 获取存储信息验证
   */
  getStorageInfo: z.object({
    includeDetails: CommonValidators.boolean.default(false),
    path: z.string().optional()
  }),

  /**
   * 系统设置更新验证
   */
  updateSystemSettings: z.object({
    theme: z.enum(['light', 'dark', 'auto'], {
      message: '主题必须是light、dark或auto之一'
    }).optional(),
    language: CommonValidators.languageCode.optional(),
    autoSync: CommonValidators.boolean.optional(),
    syncInterval: z.coerce.number().int().min(1).max(1440, '同步间隔不能超过1440分钟').optional(),
    maxConcurrentJobs: z.coerce.number().int().min(1).max(10, '最大并发任务数不能超过10').optional(),
    logLevel: z.enum(['debug', 'info', 'warn', 'error'], {
      message: '日志级别必须是debug、info、warn或error之一'
    }).optional(),
    enableNotifications: CommonValidators.boolean.optional(),
    storageCleanupEnabled: CommonValidators.boolean.optional(),
    storageCleanupDays: z.coerce.number().int().min(1).max(365).optional()
  }).refine(
    (data) => {
      // 至少要更新一个设置
      return Object.values(data).some(value => value !== undefined);
    },
    {
      message: '至少需要提供一个要更新的设置'
    }
  ),

  /**
   * 媒体库扫描验证
   */
  scanMediaLibrary: z.object({
    path: CommonValidators.filePath.optional(),
    forceRescan: CommonValidators.boolean.default(false),
    recursive: CommonValidators.boolean.default(true),
    includeSubtitles: CommonValidators.boolean.default(true),
    skipExisting: CommonValidators.boolean.default(true)
  }),

  /**
   * 清理任务验证
   */
  cleanupTask: z.object({
    type: z.enum(['orphaned_files', 'empty_directories', 'duplicate_files', 'temp_files'], {
      message: '清理类型必须是orphaned_files、empty_directories、duplicate_files或temp_files之一'
    }),
    dryRun: CommonValidators.boolean.default(true),
    path: CommonValidators.filePath.optional()
  }),

  /**
   * 日志查询验证
   */
  getLogs: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error'], {
      message: '日志级别必须是debug、info、warn或error之一'
    }).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(1000, 'limit不能超过1000').default(100),
    page: z.coerce.number().int().min(1).default(1),
    search: z.string().max(100, '搜索关键词不能超过100个字符').optional()
  }).refine(
    (data) => {
      // 如果提供了开始日期和结束日期，确保开始日期早于结束日期
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    {
      message: '开始日期必须早于或等于结束日期',
      path: ['startDate', 'endDate']
    }
  )
};

/**
 * 仪表板查询参数验证器
 */
export const DashboardQueryValidators = {
  /**
   * 统计信息查询参数
   */
  stats: z.object({
    timeRange: z.enum(['day', 'week', 'month', 'year']).default('week'),
    includeDetails: CommonValidators.boolean.default(false)
  }),

  /**
   * 最近媒体查询参数
   */
  recentMedia: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(10),
    type: CommonValidators.mediaType.optional(),
    days: z.coerce.number().int().min(1).max(365).default(7)
  }),

  /**
   * 存储信息查询参数
   */
  storage: z.object({
    includeDetails: CommonValidators.boolean.default(false),
    path: z.string().optional()
  }),

  /**
   * 日志查询参数
   */
  logs: CommonValidators.pagination.extend({
    level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
    startDate: z.iso.datetime().optional(),
    endDate: z.iso.datetime().optional(),
    search: z.string().max(100).optional()
  })
};

