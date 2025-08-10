import { Request, Response } from "express";
import { systemService } from "../services";
import { logger, LogLevel } from "../utils/logger";
import {
  success,
  successWithPagination,
  internalError,
} from "../utils/response";

export class SystemController {
  // 获取系统日志
  static async getLogs(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const level = req.query.level as LogLevel;
      const keyword = req.query.keyword as string | undefined;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";
      const logs = systemService.getLogs(
        page,
        limit,
        level,
        keyword,
        sortBy,
        sortOrder
      );
      successWithPagination(res, logs, "获取系统日志成功");
    } catch (error) {
      logger.error(`获取系统日志失败`, error);
      internalError(res, "获取系统日志失败");
    }
  }

  // 获取系统配置
  static async getConfig(req: Request, res: Response) {
    try {
      const config = systemService.getConfig();
      success(res, config, "获取系统配置成功");
    } catch (error) {
      logger.error(`获取系统配置失败`, error);
      internalError(res, "获取系统配置失败");
    }
  }

  // 更新系统配置
  static async updateConfig(req: Request, res: Response) {
    try {
      const updatedConfig = systemService.updateConfig(req.body);
      success(res, updatedConfig, "更新系统配置成功");
    } catch (error) {
      logger.error(`更新系统配置失败`, error);
      internalError(res, "更新系统配置失败");
    }
  }
}

export default SystemController;
