import { logger, LogLevel } from "../utils/logger";
import {
  getConfig,
  Config,
  updateConfig as updateConfigFile,
} from "../config/config";
import { getPrompt, updatePrompt } from "../config/prompt";

export class SystemService {
  // 获取系统日志
  getLogs(
    page: number = 1,
    limit: number = 100,
    level?: LogLevel,
    keyword?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ) {
    try {
      const { logs, total } = logger.getLogs(
        page,
        limit,
        level,
        keyword,
        sortBy,
        sortOrder
      );
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
      const {
        tmdbApi,
        useLlm,
        llmProvider,
        llmHost,
        llmModel,
        openaiApiKey,
        openaiModel,
        openaiBaseUrl,
        persistentLogging,
      } = config;
      const llmPrompt = getPrompt();
      logger.info("获取系统配置成功");
      return {
        tmdbApi,
        useLlm,
        llmProvider,
        llmHost,
        llmModel,
        openaiApiKey,
        openaiModel,
        openaiBaseUrl,
        llmPrompt,
        persistentLogging,
      };
    } catch (error) {
      logger.error(`获取系统配置失败`, error);
      throw error;
    }
  }

  // 更新系统配置
  updateConfig(data: Partial<Config & { llmPrompt: string }>) {
    try {
      const { llmPrompt, ...configData } = data;

      // 更新 prompt
      if (typeof llmPrompt === "string") {
        updatePrompt(llmPrompt);
      }

      // 更新 config
      if (Object.keys(configData).length > 0) {
        updateConfigFile(configData);
        logger.info(`更新系统配置成功: ${JSON.stringify(configData)}`);
      }

      return this.getConfig();
    } catch (error) {
      logger.error(`更新系统配置失败`, error);
      throw error;
    }
  }
}

