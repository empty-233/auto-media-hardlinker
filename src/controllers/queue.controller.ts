import { Request, Response } from "express";
import { logger } from "../utils/logger";
import {
  success,
  badRequest,
  internalError,
  notFound,
  successWithPagination,
} from "../utils/response";
import { getQueueService } from "../queue/queueService";
import * as fs from "fs";
import * as path from "path";
import { clearConfigCache } from "../config/config";

// 队列管理控制器
export class QueueController {
  // 获取队列统计信息
  static async getStats(req: Request, res: Response) {
    try {
      const queueService = getQueueService();
      const stats = await queueService.getStats();

      logger.info("获取队列统计信息成功");
      success(res, stats, "获取统计信息成功");
    } catch (error) {
      logger.error("获取队列统计信息失败", error);
      internalError(res, "获取统计信息失败，请稍后重试");
    }
  }

  // 获取任务列表
  static async getTasks(req: Request, res: Response) {
    try {
      const { page, limit, status, sortBy, sortOrder } = req.query as any;
      const offset = (page - 1) * limit;

      const queueService = getQueueService();
      const { items, total } = await queueService.getTasks({
        status,
        limit,
        offset,
        sortBy,
        sortOrder,
      });

      const paginatedData = {
        items,
        total,
        page,
        limit,
      };

      logger.info(`获取任务列表成功，返回 ${items.length} 个任务`);
      successWithPagination(res, paginatedData, "获取任务列表成功");
    } catch (error) {
      logger.error("获取任务列表失败", error);
      internalError(res, "获取任务列表失败，请稍后重试");
    }
  }

  // 重试指定任务
  static async retryTask(req: Request, res: Response) {
    try {
      const { taskId } = req.params;

      if (!taskId) {
        return badRequest(res, "缺少任务ID");
      }

      const queueService = getQueueService();
      const success_flag = await queueService.retryTask(parseInt(taskId));

      if (success_flag) {
        logger.info(`重试任务成功: ID ${taskId}`);
        success(res, null, "任务已重新加入队列");
      } else {
        notFound(res, "任务不存在或无法重试");
      }
    } catch (error) {
      logger.error(`重试任务失败: ID ${req.params.taskId}`, error);
      internalError(res, "重试任务失败，请稍后重试");
    }
  }

  // 取消指定任务
  static async cancelTask(req: Request, res: Response) {
    try {
      const { taskId } = req.params;

      if (!taskId) {
        return badRequest(res, "缺少任务ID");
      }

      const queueService = getQueueService();
      const success_flag = await queueService.cancelTask(parseInt(taskId));

      if (success_flag) {
        logger.info(`取消任务成功: ID ${taskId}`);
        success(res, null, "任务已取消");
      } else {
        notFound(res, "任务不存在或无法取消");
      }
    } catch (error) {
      logger.error(`取消任务失败: ID ${req.params.taskId}`, error);
      internalError(res, "取消任务失败，请稍后重试");
    }
  }

  // 重试所有失败的任务
  static async retryAllFailedTasks(req: Request, res: Response) {
    try {
      const queueService = getQueueService();
      const retryCount = await queueService.retryAllFailedTasks();

      logger.info(`重试所有失败任务完成，共重试 ${retryCount} 个任务`);
      success(res, { retryCount }, `已重试 ${retryCount} 个失败任务`);
    } catch (error) {
      logger.error("重试所有失败任务失败", error);
      internalError(res, "重试失败任务失败，请稍后重试");
    }
  }

  // 清除所有失败的任务
  static async clearFailedTasks(req: Request, res: Response) {
    try {
      const queueService = getQueueService();
      const clearCount = await queueService.clearFailedTasks();

      logger.info(`清除失败任务完成，共清除 ${clearCount} 个任务`);
      success(res, { clearCount }, `已清除 ${clearCount} 个失败任务`);
    } catch (error) {
      logger.error("清除失败任务失败", error);
      internalError(res, "清除失败任务失败，请稍后重试");
    }
  }

  // 获取队列配置
  static async getConfig(req: Request, res: Response) {
    try {
      const queueService = getQueueService();
      const config = queueService.getConfig();

      logger.info("获取队列配置成功");
      success(res, config, "获取配置成功");
    } catch (error) {
      logger.error("获取队列配置失败", error);
      internalError(res, "获取配置失败，请稍后重试");
    }
  }

  // 更新队列配置
  static async updateConfig(req: Request, res: Response) {
    try {
      // 获取验证后的配置数据（已通过验证中间件验证）
      const requestData = req.body;
      const { _forceRestart, ...validatedConfig } = requestData;

      // 更新队列服务配置
      const queueService = getQueueService();
      
      // 传递 forceRestart 参数到 updateConfig，让服务自己处理重启逻辑
      await queueService.updateConfig(validatedConfig, !!_forceRestart);

      // 同时更新本地config.json文件
      try {
        const configPath = path.join(process.cwd(), "config/config.json");
        const existingConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

        // 确保queue配置对象存在
        if (!existingConfig.queue) {
          existingConfig.queue = {};
        }

        // 更新队列相关配置（排除_forceRestart）
        Object.keys(validatedConfig).forEach((key) => {
          existingConfig.queue[key] = validatedConfig[key];
        });

        // 写入配置文件
        fs.writeFileSync(
          configPath,
          JSON.stringify(existingConfig, null, 4),
          "utf-8"
        );

        // 清除配置缓存
        clearConfigCache();
        logger.info(
          `队列配置已同步到本地文件: ${JSON.stringify(validatedConfig)}`
        );
      } catch (configError) {
        // 即使本地文件更新失败，也不影响队列服务配置的更新
        logger.warn(`更新本地配置文件失败，但队列配置已生效: ${configError}`);
      }

      const message = _forceRestart ? "配置已更新，队列已强制重启" : "配置已更新";
      logger.info(`更新队列配置成功 (强制重启: ${!!_forceRestart})`);
      success(res, queueService.getConfig(), message);
    } catch (error) {
      logger.error("更新队列配置失败", error);
      internalError(res, "更新配置失败，请稍后重试");
    }
  }

  // 检查队列服务状态
  static async getStatus(req: Request, res: Response) {
    try {
      const queueService = getQueueService();
      const isRunning = queueService.isRunning();
      const stats = await queueService.getStats();

      const status = {
        running: isRunning,
        stats,
        config: queueService.getConfig(),
      };

      logger.info("获取队列服务状态成功");
      success(res, status, "获取状态成功");
    } catch (error) {
      logger.error("获取队列服务状态失败", error);
      internalError(res, "获取状态失败，请稍后重试");
    }
  }
}
