import { Request, Response } from "express";
import { systemService } from "../services";
import { logger, LogLevel } from "../utils/logger";
import { success, badRequest, internalError } from "../utils/response";

export class SystemController {
  // 获取系统日志
  static async getLogs(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const level = req.query.level as LogLevel;
      const keyword = req.query.keyword as string | undefined;
      const logs = systemService.getLogs(limit, level, keyword);
      success(res, logs, "获取系统日志成功");
    } catch (error) {
      logger.error(`获取系统日志失败: ${error}`);
      console.error("获取系统日志失败:", error);
      internalError(res, "获取系统日志失败");
    }
  }

  // 获取系统配置
  static async getConfig(req: Request, res: Response) {
    try {
      const config = systemService.getConfig();
      success(res, config, "获取系统配置成功");
    } catch (error) {
      logger.error(`获取系统配置失败: ${error}`);
      console.error("获取系统配置失败:", error);
      internalError(res, "获取系统配置失败");
    }
  }

  // 更新系统配置
  static async updateConfig(req: Request, res: Response) {
    try {
      const { useLlm, llmHost, llmModel } = req.body;

      // 验证参数类型
      if (useLlm !== undefined && typeof useLlm !== "boolean") {
        badRequest(res, "useLlm参数必须是布尔值");
        return;
      }

      if (llmHost !== undefined && typeof llmHost !== "string") {
        badRequest(res, "llmHost参数必须是字符串");
        return;
      }

      if (llmModel !== undefined && typeof llmModel !== "string") {
        badRequest(res, "llmModel参数必须是字符串");
        return;
      }

      // 验证URL格式
      if (llmHost && llmHost.trim()) {
        try {
          new URL(llmHost);
        } catch {
          badRequest(res, "llmHost必须是有效的URL格式");
          return;
        }
      }

      const updatedConfig = systemService.updateConfig({ useLlm, llmHost, llmModel });
      success(res, updatedConfig, "更新系统配置成功");
    } catch (error) {
      logger.error(`更新系统配置失败: ${error}`);
      console.error("更新系统配置失败:", error);
      internalError(res, "更新系统配置失败");
    }
  }
}

export default SystemController;
