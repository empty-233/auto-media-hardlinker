import { z } from 'zod';
import { CommonValidators } from './common.validator';

/**
 * 队列模块验证器
 */
export const QueueValidator = {
  /**
   * 更新队列配置的验证规则
   * 
   * - 所有字段都是可选的，因为前端可能只发送变更的字段
   * - 并发数、延迟时间、超时时间等都有合理的范围限制
   * - 使用 coerce 自动转换字符串为数字
   */
  updateConfig: z.object({
    concurrency: z.coerce.number()
      .int('并发数必须是整数')
      .min(1, '并发数不能小于1')
      .max(20, '并发数不能超过20')
      .optional(),
    
    retryDelay: z.coerce.number()
      .int('重试延迟必须是整数')
      .min(100, '重试延迟不能小于100ms')
      .max(60000, '重试延迟不能超过60秒')
      .optional(),
    
    maxRetryDelay: z.coerce.number()
      .int('最大重试延迟必须是整数')
      .min(1000, '最大重试延迟不能小于1秒')
      .max(3600000, '最大重试延迟不能超过1小时')
      .optional(),
    
    defaultMaxRetries: z.coerce.number()
      .int('默认最大重试次数必须是整数')
      .min(0, '默认最大重试次数不能小于0')
      .max(10, '默认最大重试次数不能超过10')
      .optional(),
    
    processingTimeout: z.coerce.number()
      .int('处理超时时间必须是整数')
      .min(30000, '处理超时时间不能小于30秒')
      .max(3600000, '处理超时时间不能超过1小时')
      .optional(),
    
    batchSize: z.coerce.number()
      .int('批次大小必须是整数')
      .min(1, '批次大小不能小于1')
      .max(100, '批次大小不能超过100')
      .optional(),
    
    queuePollInterval: z.coerce.number()
      .int('队列轮询间隔必须是整数')
      .min(100, '队列轮询间隔不能小于100ms')
      .max(10000, '队列轮询间隔不能超过10秒')
      .optional(),
    
    errorRetryInterval: z.coerce.number()
      .int('错误重试间隔必须是整数')
      .min(1000, '错误重试间隔不能小于1秒')
      .max(60000, '错误重试间隔不能超过60秒')
      .optional(),
    
    timeoutCleanupInterval: z.coerce.number()
      .int('超时清理间隔必须是整数')
      .min(30000, '超时清理间隔不能小于30秒')
      .max(600000, '超时清理间隔不能超过10分钟')
      .optional(),
  }).refine(data => {
    // 如果同时设置了重试延迟和最大重试延迟，确保最大重试延迟大于重试延迟
    if (data.retryDelay !== undefined && data.maxRetryDelay !== undefined) {
      return data.maxRetryDelay >= data.retryDelay;
    }
    return true;
  }, {
    message: '最大重试延迟必须大于等于重试延迟',
    path: ['maxRetryDelay'],
  }),

  /**
   * 任务查询参数验证
   */
  getTasksQuery: CommonValidators.pagination.extend({
    status: z
      .enum(["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELED"], {
        message: "字段 status 状态必须是有效的任务状态",
      })
      .optional(),
    sortBy: z
      .enum(["createdAt", "priority", "updatedAt"], {
        message: "排序字段必须是 createdAt、priority 或 updatedAt",
      })
      .optional(),
    sortOrder: z
      .enum(["asc", "desc"], {
        message: "排序顺序必须是 asc 或 desc",
      })
      .optional(),
  }),

  /**
   * 任务ID参数验证
   */
  taskIdParam: z.object({
    taskId: CommonValidators.id,
  }),
};
