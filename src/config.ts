import * as fs from "fs";
import * as path from "path";

/**
 * 配置文件接口定义
 */
export interface Config {
  monitorFilePath: string;
  targetFilePath: string;
  tmdbApi: string;
  language: string;
  // LLM相关配置
  llmHost?: string;
  llmModel?: string;
  useLlm?: boolean;
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

    if (!config.useLlm && (!config.llmHost || !config.llmModel)) {
      throw new Error("LLM相关配置不完整");
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
