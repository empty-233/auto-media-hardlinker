import { z } from "zod";
import { LogLevel } from "@/config/env";
import { CommonValidators } from "./common.validator";

/**
 * 扫描查询参数验证器
 *
 * 用于验证扫描相关接口的查询参数，如分页、状态筛选、排序等。
 * 结合通用查询参数验证，提供扫描特定的查询逻辑。
 */
export const ScanQueryValidators = {
  /**
   * 扫描日志查询参数
   * 包含分页、日志级别和时间筛选
   *
   * @example
   * // 查询: "?page=1&limit=50&level=error&startDate=2024-01-01"
   * // 验证后: { page: 1, limit: 50, level: "error", startDate: "2024-01-01" }
   */
  logs: CommonValidators.pagination.extend({
    /** 日志级别筛选 */
    level: z.enum(LogLevel).optional(),
    /** 开始时间筛选 */
    startDate: z.string().optional(),
    /** 结束时间筛选 */
    endDate: z.string().optional(),
    /** 排序字段 */
    sortBy: z
      .enum(["scanTime", "duration", "filesFound", "filesAdded"])
      .default("scanTime"),
    /** 排序方向 */
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),

  /**
   * 库文件查询参数
   * 包含分页、处理状态和关键词搜索
   *
   * @example
   * // 查询: "?page=1&limit=20&processed=false&keyword=video"
   */
  libraryFiles: CommonValidators.pagination.extend({
    /** 文件类型筛选 */
    type: z.enum(["video", "subtitle", "other"]).optional(),
    /** 状态筛选 */
    status: z.enum(["PENDING", "PROCESSED", "ERROR", "IGNORED"]).optional(),
  }),

  /**
   * 扫描任务查询参数
   * 包含分页、任务状态和时间筛选
   *
   * @example
   * // 查询: "?page=1&limit=20&status=RUNNING&type=auto"
   */
  tasks: CommonValidators.pagination.extend({
    /** 任务状态筛选 */
    status: z
      .enum(["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELED"])
      .optional(),
    /** 任务类型筛选 */
    type: z.enum(["manual", "auto", "scheduled"]).optional(),
    /** 开始时间筛选 */
    startDate: z.string().optional(),
    /** 结束时间筛选 */
    endDate: z.string().optional(),
  }),
};

/**
 * 扫描请求体验证器
 *
 * 用于验证扫描相关的请求体数据，如配置更新、手动扫描触发等。
 * 包含扫描配置和操作相关的验证规则。
 */
export const ScanBodyValidators = {
  /**
   * 更新扫描配置请求体验证
   * 验证更新扫描系统配置时的字段
   *
   * @example
   * {
   *   interval: 30,
   *   concurrency: 30,
   *   enabled: true
   * }
   */
  updateConfig: z.object({
    /** 扫描间隔（分钟），可选 */
    interval: z.coerce
      .number()
      .int()
      .min(1, "扫描间隔必须大于0分钟")
      .max(10080, "扫描间隔不能超过7天")
      .optional(),
    /** 是否启用自动扫描，可选 */
    enabled: z.coerce.boolean().optional(),
    /** 扫描并发数，可选 */
    concurrency: z.coerce
      .number()
      .int()
      .min(1, "并发数必须大于0")
      .max(10, "并发数不能超过10")
      .optional(),
  }),

  /**
   * 手动扫描请求体验证
   * 验证手动触发扫描时的参数
   *
   * @example
   * {
   *   path: "/media/movies",
   *   recursive: true,
   *   force: false
   * }
   */
  manualScan: z.object({
    /** 扫描路径，必填 */
    path: CommonValidators.filePath,
    /** 是否递归扫描子目录 */
    recursive: z.coerce.boolean().default(true),
    /** 是否强制重新扫描已处理的文件 */
    force: z.coerce.boolean().default(false),
    /** 扫描类型 */
    type: z.enum(["quick", "full", "deep"]).default("full"),
  }),
};
