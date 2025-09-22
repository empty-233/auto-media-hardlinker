import { z } from "zod";
import { CommonValidators } from "./common.validator";

/**
 * 队列路径参数验证器
 *
 * 用于验证队列相关路由中的路径参数，如任务ID、队列名称等。
 * 继承通用参数验证逻辑，提供队列特定的验证规则。
 */
export const QueueParamValidators = {
  /**
   * 任务ID参数验证
   * 验证路径中的任务ID参数
   *
   * @example
   * // 路由: "/api/queue/tasks/:id"
   * // 验证: { id: "123" } -> { id: 123 }
   */
  taskId: z.object({
    taskId: CommonValidators.id,
  }),

  /**
   * 队列名称参数验证
   * 验证路径中的队列名称参数
   *
   * @example
   * // 路由: "/api/queue/:queueName"
   * // 验证: { queueName: "media-processing" }
   */
  queueName: z.object({
    queueName: z
      .string()
      .trim()
      .min(1, "队列名称不能为空")
      .max(50, "队列名称不能超过50个字符"),
  }),
};

/**
 * 队列查询参数验证器
 *
 * 用于验证队列相关接口的查询参数，如分页、状态筛选、优先级等。
 * 结合通用查询参数验证，提供队列特定的查询逻辑。
 */
export const QueueQueryValidators = {
  /**
   * 任务列表查询参数
   * 包含分页、状态筛选、优先级和时间筛选
   *
   * @example
   * // 查询: "?page=1&limit=20&status=RUNNING&priority=high&type=media-scan"
   * // 验证后: { page: 1, limit: 20, status: "RUNNING", priority: "high", type: "media-scan" }
   */
  tasks: CommonValidators.pagination.extend({
    /** 任务状态筛选 */
    status: z
      .enum(["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELED"])
      .optional(),
    /** 任务类型筛选 */
    type: z.string().trim().optional(),
    /** 优先级筛选 */
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    /** 队列名称筛选 */
    queueName: z.string().trim().optional(),
    /** 开始时间筛选 */
    startDate: z.string().optional(),
    /** 结束时间筛选 */
    endDate: z.string().optional(),
    /** 排序字段 */
    sortBy: z
      .enum(["createdAt", "updatedAt", "priority", "type"])
      .default("createdAt"),
    /** 排序方向 */
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),

  /**
   * 任务统计查询参数
   * 用于获取任务统计信息的参数验证
   *
   * @example
   * // 查询: "?period=24h&groupBy=status"
   */
  statistics: z.object({
    /** 统计时间段 */
    period: z.enum(["1h", "6h", "12h", "24h", "7d", "30d"]).default("24h"),
    /** 分组方式 */
    groupBy: z
      .enum(["status", "type", "queue", "hour", "day"])
      .default("status"),
  }),

  /**
   * 队列状态查询参数
   * 用于获取队列状态信息的参数验证
   *
   * @example
   * // 查询: "?includeMetrics=true&includeWorkers=false"
   */
  status: z.object({
    /** 是否包含详细指标 */
    includeMetrics: z.coerce.boolean().default(false),
    /** 是否包含工作线程信息 */
    includeWorkers: z.coerce.boolean().default(false),
    /** 指定队列名称，可选 */
    queueName: z.string().trim().optional(),
  }),
};

/**
 * 队列请求体验证器
 *
 * 用于验证队列相关的请求体数据，如配置更新、任务创建等。
 * 包含队列配置和任务管理相关的验证规则。
 */
export const QueueBodyValidators = {
  /**
   * 更新队列配置请求体验证
   * 验证更新队列系统配置时的字段
   *
   * @example
   * {
   *   concurrency: 5,
   *   retryAttempts: 3,
   *   retryDelay: 1000,
   *   timeout: 30000
   * }
   */
  updateConfig: z
    .object({
      /** 并发数，可选 */
      concurrency: z.coerce
        .number()
        .int()
        .min(1, "并发数必须大于0")
        .max(10, "并发数不能超过10")
        .optional(),
      /** 重试延迟（毫秒），可选 */
      retryDelay: z.coerce
        .number()
        .int("重试延迟必须是整数")
        .min(100, "重试延迟不能小于100ms")
        .max(60000, "重试延迟不能超过60秒")
        .optional(),
      /** 最大重试延迟（毫秒），可选 */
      maxRetryDelay: z.coerce
        .number()
        .int("最大重试延迟必须是整数")
        .min(1000, "最大重试延迟不能小于1秒")
        .max(3600000, "最大重试延迟不能超过1小时")
        .optional(),
      /** 默认重试次数，可选 */
      defaultMaxRetries: z.coerce
        .number()
        .int("默认最大重试次数必须是整数")
        .min(0, "默认最大重试次数不能小于0")
        .max(10, "默认最大重试次数不能超过10")
        .optional(),
      /** 任务超时时间（毫秒），可选 */
        queuePollInterval: z.coerce.number()
      .int('队列轮询间隔必须是整数')
      .min(100, '队列轮询间隔不能小于100ms')
      .max(10000, '队列轮询间隔不能超过10秒')
      .optional(),
      /** 任务处理超时时间（毫秒），可选 */
      processingTimeout: z.coerce
        .number()
        .int("处理超时时间必须是整数")
        .min(30000, "处理超时时间不能小于30秒")
        .max(3600000, "处理超时时间不能超过1小时")
        .optional(),
      /** 批处理大小，可选 */
      batchSize: z.coerce
        .number()
        .int()
        .min(1, "批处理大小必须大于0")
        .max(100, "批处理大小不能超过100")
        .optional(),
      /** 错误重试间隔（毫秒），可选 */
      errorRetryInterval: z.coerce.number()
      .int('错误重试间隔必须是整数')
      .min(1000, '错误重试间隔不能小于1秒')
      .max(60000, '错误重试间隔不能超过60秒')
      .optional(),
      /** 是否启用队列，可选 */
      enabled: z.coerce.boolean().optional(),
      /** 队列优先级，可选 */
      priority: z.enum(["low", "normal", "high"]).optional(),
      /** 是否强制重启队列，可选 */
      _forceRestart: z.boolean().optional().default(false),
    })
    .refine(
      (data) => {
        // 确保重试延迟合理
        if (data.retryDelay !== undefined && data.maxRetryDelay !== undefined) {
          return data.retryDelay <= data.maxRetryDelay;
        }
        return true;
      },
      {
        message: "重试延迟不能大于等于最大重试延迟",
        path: ["retryDelay"],
      }
    ),
};
