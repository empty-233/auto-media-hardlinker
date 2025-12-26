import fs from "fs";
import path from "path";
import { QueueConfig } from "@/types/queue.types";
import { logger } from "@/utils/logger";
import { isDevelopment } from '@/config/env';

/**
 * 扫描配置接口
 */
export interface ScanConfig {
  enabled: boolean;
  interval: number; // 间隔时间(分钟)
  concurrency: number;
  scanMaxDepth: number; // 扫描最大深度，用于特殊文件夹结构识别
}

/**
 * 配置文件接口定义
 */
export interface Config {
  monitorFilePath: string;
  targetFilePath: string;
  tmdbApi: string;
  language: string;
  videoExtensions: string[];
  subtitleExtensions: string[];
  scanConfig: ScanConfig;
  // LLM相关配置
  llmProvider?: "ollama" | "openai";
  llmHost?: string;
  llmModel?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  openaiBaseUrl?: string;
  // 日志配置
  persistentLogging: boolean;
  // 队列配置
  queue?: Partial<QueueConfig>;
}

// 缓存配置，避免重复读取
let cachedConfig: Config | null = null;

/**
 * 读取配置文件
 * @param configPath 配置文件路径，默认为项目根目录下的config.json
 * @param useCache 是否使用缓存的配置，默认为true
 * @returns 配置对象
 */
export function getConfig(
  useCache: boolean = true,
  configPath: string = path.join(process.cwd(), "config/config.json")
): Config {
  // 如果使用缓存且缓存存在，直接返回缓存
  if (useCache && cachedConfig) {
    return cachedConfig;
  }

  try {
    // 检查配置文件是否存在
    if (!fs.existsSync(configPath)) {
      throw new Error(`配置文件不存在: ${configPath}`);
    }

    // 读取并解析配置文件
    const rawConfig = fs.readFileSync(configPath, "utf-8");
    // 移除JSON中的注释（如果有）
    // const jsonString = rawConfig.replace(/\/\/.*$/gm, "");
    const config = JSON.parse(rawConfig);

    // 验证必要的配置项
    if (!config.monitorFilePath) {
      throw new Error("配置文件缺少 monitorFilePath 字段");
    }

    if (!config.targetFilePath) {
      throw new Error("配置文件缺少 targetFilePath 字段");
    }

    if (!config.tmdbApi) {
      throw new Error("配置文件缺少 tmdbApi 字段");
    }

    if (!config.language) {
      throw new Error("配置文件缺少 language 字段");
    }

    if (!config.videoExtensions || !Array.isArray(config.videoExtensions) || config.videoExtensions.length === 0) {
      throw new Error("配置文件缺少或无效的 videoExtensions 字段");
    }

    if (!config.subtitleExtensions || !Array.isArray(config.subtitleExtensions) || config.subtitleExtensions.length === 0) {
      throw new Error("配置文件缺少或无效的 subtitleExtensions 字段");
    }

    if (!config.scanConfig) {
      throw new Error("配置文件缺少 scanConfig 字段");
    }

    if (typeof config.scanConfig.enabled !== "boolean") {
      throw new Error("配置文件中的 scanConfig.enabled 字段必须是布尔值");
    }

    if (typeof config.scanConfig.interval !== "number" || config.scanConfig.interval < 1) {
      throw new Error("配置文件中的 scanConfig.interval 字段必须是大于等于1的数字(分钟)");
    }

    if (typeof config.scanConfig.concurrency !== "number" || config.scanConfig.concurrency < 1) {
      throw new Error("配置文件中的 scanConfig.concurrency 字段必须是大于0的数字");
    }

    if (config.scanConfig.scanMaxDepth === undefined || typeof config.scanConfig.scanMaxDepth !== "number" || config.scanConfig.scanMaxDepth < 1) {
      throw new Error("配置文件中的 scanConfig.scanMaxDepth 字段必须是大于等于1的数字");
    }

    // LLM 配置验证
    if (!config.llmProvider) {
      throw new Error("必须指定 llmProvider (ollama 或 openai)");
    }
    if (config.llmProvider === "ollama" && (!config.llmHost || !config.llmModel)) {
      throw new Error("Ollama配置不完整，需要 llmHost 和 llmModel");
    }
    if (config.llmProvider === "openai" && (!config.openaiApiKey || !config.openaiModel)) {
      throw new Error("OpenAI配置不完整，需要 openaiApiKey 和 openaiModel");
    }

    // 验证持久化日志配置
    if (config.persistentLogging !== undefined && typeof config.persistentLogging !== "boolean") {
      throw new Error("配置文件中的 persistentLogging 字段必须是布尔值 (true/false)");
    }

    // 检测路径是否存在
    if (!fs.existsSync(config.monitorFilePath)) {
      throw new Error(`该路径不存在: ${config.monitorFilePath}`);
    }
    if (!fs.existsSync(config.targetFilePath)) {
      throw new Error(`该路径不存在: ${config.targetFilePath}`);
    }

    // 保存到缓存
    cachedConfig = config;

    return config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`读取配置文件失败: ${error.message}`);
    }
    throw new Error("读取配置文件时出现未知错误");
  }
}

/**
 * 清除配置缓存
 */
export function clearConfigCache() {
  cachedConfig = null;
}

/**
 * 更新配置文件
 * @param updateData 要更新的配置数据
 * @param configPath 配置文件路径
 */
export function updateConfig(
  updateData: Partial<Config>,
  configPath: string = path.join(process.cwd(), "config/config.json")
): Config {
  try {
    // 读取现有配置
    const existingConfig = fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, "utf-8"))
      : {};

    // 合并新旧配置
    const newConfig = { ...existingConfig, ...updateData };

    // 将更新后的配置写回文件
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 4), "utf-8");

    // 清除缓存，以便下次能获取最新配置
    clearConfigCache();

    // 如果更新了日志相关配置，触发logger重新初始化
    if (updateData.persistentLogging !== undefined) {
      try {
        // 直接调用logger的reinitialize方法
        if (logger && typeof logger.reinitialize === 'function') {
          logger.reinitialize();
        }
      } catch (_error) {
        // logger重新初始化失败，记录警告但不影响配置更新
        console.warn('Logger重新初始化失败:', _error instanceof Error ? _error.message : String(_error));
      }
    }

    // 记录LLM相关配置更新日志，以便调试
    if(isDevelopment()){
      const llmConfigKeys = ['llmProvider', 'llmHost', 'llmModel', 'openaiApiKey', 'openaiModel', 'openaiBaseUrl'];
      const updatedLlmKeys = Object.keys(updateData).filter(key => llmConfigKeys.includes(key));
      if (updatedLlmKeys.length > 0) {
        console.log(`LLM配置已更新，清除缓存: ${updatedLlmKeys.join(', ')}`);
      }
    }

    // 重新获取并返回最新配置
    return getConfig(false, configPath);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`更新配置文件失败: ${error.message}`);
    }
    throw new Error("更新配置文件时出现未知错误");
  }
}
