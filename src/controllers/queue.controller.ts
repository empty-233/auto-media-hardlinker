import { Response } from "express";
import {
  success,
  notFound,
  successWithPagination,
} from "../utils/response";
import { getQueueService } from "../queue/queueService";
import * as fs from "fs";
import * as path from "path";
import { clearConfigCache } from "../config/config";
import { TypedController, TypedRequest } from "./base.controller";
import { QueueParamValidators, QueueQueryValidators, QueueBodyValidators } from "../validators";
import { logger } from "../utils/logger";
import { z } from "zod";

// 类型推导
type GetTasksQuery = z.infer<typeof QueueQueryValidators.tasks>;
type TaskIdParam = z.infer<typeof QueueParamValidators.taskId>;
type UpdateConfigBody = z.infer<typeof QueueBodyValidators.updateConfig>;

// 队列管理控制器
export class QueueController extends TypedController {
  constructor() {
    super();
  }

  // 获取队列统计信息
  getStats = this.asyncHandler(async (req: TypedRequest, res: Response) => {
    const queueService = getQueueService();
    const stats = await queueService.getStats();

    logger.info("获取队列统计信息成功");
    success(res, stats, "获取统计信息成功");
  });

  // 获取任务列表
  getTasks = this.asyncHandler(async (req: TypedRequest<{}, GetTasksQuery>, res: Response) => {
    const { page, limit, status } = req.query;
    const offset = (page - 1) * limit;

    const queueService = getQueueService();
    const { items, total } = await queueService.getTasks({
      status,
      limit,
      offset,
    });

    const paginatedData = {
      items,
      total,
      page,
      limit,
    };

    logger.info(`获取任务列表成功，返回 ${items.length} 个任务`);
    successWithPagination(res, paginatedData, "获取任务列表成功");
  });

  // 获取队列服务状态
  getStatus = this.asyncHandler(async (req: TypedRequest, res: Response) => {
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
  });

  // 获取队列配置
  getConfig = this.asyncHandler(async (req: TypedRequest, res: Response) => {
    const queueService = getQueueService();
    const config = queueService.getConfig();

    logger.info("获取队列配置成功");
    success(res, config, "获取配置成功");
  });

  // 更新队列配置
  updateConfig = this.asyncHandler(async (req: TypedRequest<{}, {}, UpdateConfigBody>, res: Response) => {
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
      const definedConfig = Object.fromEntries(
        Object.entries(validatedConfig).filter(([, value]) => value !== undefined)
      );
      Object.assign(existingConfig.queue, definedConfig);

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
    } catch (error) {
      // 即使本地文件更新失败，也不影响队列服务配置的更新
      logger.warn(`更新本地配置文件失败，但队列配置已生效: ${error}`);
    }

    const message = _forceRestart ? "配置已更新，队列已强制重启" : "配置已更新";
    logger.info(`更新队列配置成功 (强制重启: ${!!_forceRestart})`);
    success(res, queueService.getConfig(), message);
  });

  // 重试所有失败的任务
  retryAllFailedTasks = this.asyncHandler(async (req: TypedRequest, res: Response) => {
    const queueService = getQueueService();
    const retryCount = await queueService.retryAllFailedTasks();

    logger.info(`重试所有失败任务完成，共重试 ${retryCount} 个任务`);
    success(res, { retryCount }, `已重试 ${retryCount} 个失败任务`);
  });

  // 清除所有失败的任务
  clearFailedTasks = this.asyncHandler(async (req: TypedRequest, res: Response) => {
    const queueService = getQueueService();
    const clearCount = await queueService.clearFailedTasks();

    logger.info(`清除失败任务完成，共清除 ${clearCount} 个任务`);
    success(res, { clearCount }, `已清除 ${clearCount} 个失败任务`);
  });

  // 重试指定任务
  retryTask = this.asyncHandler(async (req: TypedRequest<TaskIdParam>, res: Response) => {
    const { taskId } = req.params;

    const queueService = getQueueService();
    const success_flag = await queueService.retryTask(taskId);

    if (success_flag) {
      logger.info(`重试任务成功: ID ${taskId}`);
      success(res, null, "任务已重新加入队列");
    } else {
      notFound(res, "任务不存在或无法重试");
    }
  });

  // 取消指定任务
  cancelTask = this.asyncHandler(async (req: TypedRequest<TaskIdParam>, res: Response) => {
    const { taskId } = req.params;

    const queueService = getQueueService();
    const success_flag = await queueService.cancelTask(taskId);

    if (success_flag) {
      logger.info(`取消任务成功: ID ${taskId}`);
      success(res, null, "任务已取消");
    } else {
      notFound(res, "任务不存在或无法取消");
    }
  });
}