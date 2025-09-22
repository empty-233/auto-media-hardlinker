import { Router } from "express";
import { QueueController } from "../controllers/queue.controller";
import { createValidator } from "../middleware/validation.middleware";
import { QueueParamValidators, QueueQueryValidators, QueueBodyValidators } from "../validators";

const queueController = new QueueController();
const router = Router();

// 获取队列统计信息
router.get("/stats", queueController.getStats);

// 获取任务列表
router.get(
  "/tasks", 
  createValidator({
    query: QueueQueryValidators.tasks
  }),
  queueController.getTasks
);

// 获取队列服务状态
router.get("/status", queueController.getStatus);

// 获取队列配置
router.get("/config", queueController.getConfig);

// 更新队列配置
router.put(
  "/config", 
  createValidator({
    body: QueueBodyValidators.updateConfig
  }),
  queueController.updateConfig
);

// 重试所有失败的任务
router.post("/tasks/retry-all-failed", queueController.retryAllFailedTasks);

// 清除所有失败的任务
router.delete("/tasks/failed", queueController.clearFailedTasks);

// 重试指定任务
router.post(
  "/tasks/:taskId/retry",
  createValidator({
    params: QueueParamValidators.taskId
  }),
  queueController.retryTask
);

// 取消指定任务
router.delete(
  "/tasks/:taskId",
  createValidator({
    params: QueueParamValidators.taskId
  }),
  queueController.cancelTask
);

export default router;