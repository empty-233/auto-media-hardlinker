import { z } from "zod";
import { LogLevel } from "@/utils/logger";
import { CommonValidators } from "./common.validator";

/**
 * 系统查询参数验证器
 *
 * 用于验证系统相关接口的查询参数，如系统状态、日志查询等。
 * 结合通用查询参数验证，提供系统管理特定的查询逻辑。
 */
export const SystemQueryValidators = {
  /**
   * 系统日志查询参数
   * 包含分页、日志级别和时间筛选
   *
   * @example
   * // 查询: "?page=1&limit=50&level=error&startDate=2024-01-01"
   */
  logs: CommonValidators.pagination.extend({
    /** 日志级别筛选 */
    level: z.enum(LogLevel).optional(),
    /** 开始时间筛选 */
    startDate: z.string().optional(),
    /** 结束时间筛选 */
    endDate: z.string().optional(),
    /** 搜索关键词 */
    keyword: z.string().trim().optional(),
    /** 排序字段 */
    sortBy: z.enum(["timestamp", "level", "message"]).default("timestamp"),
    /** 排序方向 */
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),

  /**
   * 系统性能指标查询参数
   * 用于获取系统性能监控数据
   *
   * @example
   * // 查询: "?period=1h&metrics=cpu,memory,disk"
   */
  metrics: z.object({
    /** 时间段 */
    period: z.enum(["5m", "15m", "1h", "6h", "24h", "7d"]).default("1h"),
    /** 指标类型 */
    metrics: z.string().optional(),
    /** 是否包含详细信息 */
    detailed: z.coerce.boolean().default(false),
  }),

  /**
   * 系统状态查询参数
   * 用于获取系统运行状态信息
   *
   * @example
   * // 查询: "?includeServices=true&includeHealth=true"
   */
  status: z.object({
    /** 是否包含服务状态 */
    includeServices: z.coerce.boolean().default(true),
    /** 是否包含健康检查 */
    includeHealth: z.coerce.boolean().default(true),
    /** 是否包含版本信息 */
    includeVersion: z.coerce.boolean().default(false),
  }),
};

/**
 * 系统请求体验证器
 *
 * 用于验证系统相关的请求体数据，如配置更新、系统控制等。
 * 包含系统配置和管理相关的验证规则。
 */
export const SystemBodyValidators = {
  /**
   * 更新系统配置请求体验证
   * 验证更新系统配置时的字段，支持部分更新
   *
   * @example
   * {
   *   tmdbApiKey: "your-tmdb-api-key",
   *   logLevel: "info",
   *   maxLogFiles: 10,
   *   enableApiLogging: true,
   *   mediaLibraryPath: "/media/library"
   * }
   */
  updateConfig: z
    .object({
      /** TMDB API密钥，可选 */
      tmdbApiKey: z
        .string()
        .trim()
        .min(20, "TMDB API Key 长度不能少于20位")
        .optional(),
      /** 日志级别，可选 */
      logLevel: z.enum(["debug", "info", "warn", "error"]).optional(),
      /** 最大日志文件数，可选 */
      maxLogFiles: z.coerce
        .number()
        .int()
        .min(1, "最大日志文件数必须大于0")
        .optional(),
      /** 是否启用API日志记录，可选 */
      enableApiLogging: z.coerce.boolean().optional(),
      /** 媒体库路径，可选 */
      mediaLibraryPath: z
        .string()
        .trim()
        .min(1, "媒体库路径不能为空")
        .optional(),
      /** 是否启用调试模式，可选 */
      debugMode: z.coerce.boolean().optional(),
      /** 缓存配置，可选 */
      cacheConfig: z
        .object({
          /** 缓存过期时间（秒） */
          ttl: z.coerce.number().int().min(60, "缓存过期时间不能少于60秒"),
          /** 最大缓存条目数 */
          maxSize: z.coerce
            .number()
            .int()
            .min(100, "最大缓存条目数不能少于100"),
          /** 是否启用缓存 */
          enabled: z.coerce.boolean(),
        })
        .optional(),
      /** TMDB配置，可选 */
      tmdbConfig: z
        .object({
          /** 语言设置 */
          language: CommonValidators.languageCode,
          /** 地区设置 */
          region: z.string().trim().length(2, "地区代码必须是2个字符"),
          /** 是否包含成人内容 */
          includeAdult: z.coerce.boolean().default(false),
          /** 请求超时时间（毫秒） */
          timeout: z.coerce
            .number()
            .int()
            .min(5000, "请求超时时间不能少于5秒")
            .max(60000, "请求超时时间不能超过60秒"),
        })
        .optional(),
      useLlm: CommonValidators.boolean.optional(),
      llmProvider: z
        .enum(["ollama", "openai"], {
          message: 'LLM提供商必须是 "ollama" 或 "openai"',
        })
        .optional(),
      llmHost: z.string().url({ message: "llmHost必须是有效的URL" }).optional(),
      llmModel: z.string().min(1, { message: "llmModel不能为空" }).optional(),
      openaiApiKey: z
        .string()
        .min(1, { message: "openaiApiKey不能为空" })
        .optional(),
      openaiModel: z
        .string()
        .min(1, { message: "openaiModel不能为空" })
        .optional(),
      openaiBaseUrl: z
        .string()
        .url({ message: "openaiBaseUrl必须是有效的URL" })
        .optional(),
      llmPrompt: z.string().min(1, { message: "llmPrompt不能为空" }).optional(),
      persistentLogging: CommonValidators.boolean.optional(),
    })
    .refine(
      (data) => {
        // 如果启用了LLM且提供商是ollama，则其相关字段必须存在
        if (data.useLlm && data.llmProvider === "ollama") {
          return !!data.llmHost && !!data.llmModel;
        }
        return true;
      },
      {
        message: "当LLM提供商为Ollama时，llmHost和llmModel为必填项",
        path: ["ollama"], // 关联错误到虚拟路径
      }
    )
    .refine(
      (data) => {
        // 如果启用了LLM且提供商是openai，则其相关字段必须存在
        if (data.useLlm && data.llmProvider === "openai") {
          return (
            !!data.openaiApiKey && !!data.openaiModel && !!data.openaiBaseUrl
          );
        }
        return true;
      },
      {
        message:
          "当LLM提供商为OpenAI时，openaiApiKey, openaiModel和openaiBaseUrl为必填项",
        path: ["openai"], // 关联错误到虚拟路径
      }
    ),
};
