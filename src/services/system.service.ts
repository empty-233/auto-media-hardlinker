import { logger, LogLevel } from "../utils/logger";
import { getConfig } from "../config/config";
import path from "path";
import fs from "fs";

export class SystemService {
  // 获取系统日志
  getLogs(limit: number = 100, level?: LogLevel, keyword?: string) {
    try {
      const logs = logger.getLogs(limit, level, keyword);
      return logs;
    } catch (error) {
      logger.error(`获取系统日志失败: ${error}`);
      throw error;
    }
  }

  // 获取系统配置
  getConfig() {
    try {
      const config = getConfig(false); // 不使用缓存，确保获取最新配置
      // 仅返回前端需要的配置信息
      const clientConfig = {
        useLlm: config.useLlm || false,
        llmHost: config.llmHost || "http://localhost:11434",
        llmModel: config.llmModel || "qwen2.5",
      };
      logger.info("获取系统配置成功");
      return clientConfig;
    } catch (error) {
      logger.error(`获取系统配置失败: ${error}`);
      throw error;
    }
  }

  // 更新系统配置
  updateConfig(data: { useLlm?: boolean; llmHost?: string; llmModel?: string }) {
    try {
      const { useLlm, llmHost, llmModel } = data;

      // 读取现有配置
      const configPath = path.join(process.cwd(), "config/config.json");
      const existingConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

      // 更新配置
      if (useLlm !== undefined) {
        existingConfig.useLlm = useLlm;
      }
      if (llmHost !== undefined) {
        existingConfig.llmHost = llmHost;
      }
      if (llmModel !== undefined) {
        existingConfig.llmModel = llmModel;
      }

      // 写入配置文件
      fs.writeFileSync(
        configPath,
        JSON.stringify(existingConfig, null, 4),
        "utf-8"
      );

      // 刷新配置缓存
      const updatedConfig = getConfig(false);

      logger.info(`更新系统配置成功: useLlm=${useLlm}, llmHost=${llmHost}, llmModel=${llmModel}`);
      return {
        useLlm: updatedConfig.useLlm || false,
        llmHost: updatedConfig.llmHost || "http://localhost:11434",
        llmModel: updatedConfig.llmModel || "qwen2.5",
      };
    } catch (error) {
      logger.error(`更新系统配置失败: ${error}`);
      throw error;
    }
  }
}

export const systemService = new SystemService();
