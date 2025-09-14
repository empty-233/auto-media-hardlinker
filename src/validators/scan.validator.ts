import { z } from 'zod';
import { CommonValidators } from './common.validator';

/**
 * 扫描模块验证器
 */
export const ScanValidator = {
  /**
   * 更新扫描配置的验证规则
   */
  updateConfig: z.object({
    enabled: CommonValidators.boolean.optional(),
    interval: z.coerce.number()
      .int('扫描间隔必须是整数')
      .min(1, '扫描间隔不能少于1分钟')
      .max(10080, '扫描间隔不能超过7天(10080分钟)')
      .optional(),
    concurrency: z.coerce.number()
      .int('并发数必须是整数')
      .min(1, '并发数不能少于1')
      .max(20, '并发数不能超过20')
      .optional(),
  }),

  /**
   * 获取扫描日志的查询参数验证
   */
  getLogsQuery: CommonValidators.pagination.extend({
    sortBy: z.enum(['scanTime', 'duration', 'filesFound', 'filesAdded'], {
      message: '排序字段必须是 scanTime、duration、filesFound 或 filesAdded'
    }).optional().default('scanTime'),
    sortOrder: z.enum(['asc', 'desc'], {
      message: '排序方式必须是 asc 或 desc'
    }).optional().default('desc'),
  }),

  /**
   * 获取库文件的查询参数验证
   */
  getLibraryFilesQuery: CommonValidators.pagination.extend({
    type: z.enum(['video', 'subtitle'], { 
      message: '文件类型必须是 "video" 或 "subtitle"' 
    }).optional(),
    status: z.enum(['PENDING', 'PROCESSED', 'ERROR', 'IGNORED'], {
      message: '状态必须是 PENDING、PROCESSED、ERROR 或 IGNORED'
    }).optional(),
  }),

  /**
   * 库文件ID参数验证
   */
  libraryFileIdParam: z.object({
    id: CommonValidators.id,
  }),
};
