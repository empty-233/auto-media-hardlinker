import { logger, LogLevel } from "../utils/logger";
import { getConfig, Config, clearConfigCache } from "../config/config";
import path from "path";
import fs from "fs";

export class SystemService {
  // 获取系统日志
  getLogs(page: number = 1, limit: number = 100, level?: LogLevel, keyword?: string) {
    try {
      const { logs, total } = logger.getLogs(page, limit, level, keyword);
      return {
        items: logs,
        total,
        page,
        limit,
      };
    } catch (error) {
      logger.error(`获取系统日志失败`, error);
      throw error;
    }
  }

  // 获取系统配置
  getConfig() {
    try {
      const config = getConfig(false); // 不使用缓存，确保获取最新配置
      // 仅返回前端需要的配置信息
      const { useLlm, llmProvider, llmHost, llmModel, openaiApiKey, openaiModel, openaiBaseUrl } = config;
      logger.info("获取系统配置成功");
      return { useLlm, llmProvider, llmHost, llmModel, openaiApiKey, openaiModel, openaiBaseUrl };
    } catch (error) {
      logger.error(`获取系统配置失败`, error);
      throw error;
    }
  }

  // 更新系统配置
  updateConfig(data: Partial<Config>) {
    try {
      // 读取现有配置
      const configPath = path.join(process.cwd(), "config/config.json");
      const existingConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

      // 定义允许更新的字段列表
      const allowedFields: (keyof Config)[] = [
        'useLlm', 'llmProvider', 'llmHost', 'llmModel',
        'openaiApiKey', 'openaiModel', 'openaiBaseUrl'
      ];

      // 遍历传入的数据，只更新允许的字段
      Object.keys(data).forEach(key => {
        const configKey = key as keyof Config;
        if (allowedFields.includes(configKey)) {
          existingConfig[configKey] = data[configKey];
        }
      });

      // 写入配置文件
      fs.writeFileSync(
        configPath,
        JSON.stringify(existingConfig, null, 4),
        "utf-8"
      );

      // 刷新配置缓存并返回最新配置
      clearConfigCache();
      logger.info(`更新系统配置成功: ${JSON.stringify(data)}`);
      return this.getConfig();
    } catch (error) {
      logger.error(`更新系统配置失败`, error);
      throw error;
    }
  }
}

export const systemService = new SystemService();
