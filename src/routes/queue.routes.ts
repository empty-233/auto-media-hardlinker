import { Router } from "express";
import { QueueController } from "../controllers/queue.controller";
import { ValidationMiddleware, QueueValidator } from "../validators";

const router = Router();

// 获取队列统计信息
router.get("/stats", QueueController.getStats);

// 获取任务列表
router.get("/tasks", 
  ValidationMiddleware.query(QueueValidator.getTasksQuery),
  QueueController.getTasks
);

// 获取队列服务状态
router.get("/status", QueueController.getStatus);

// 获取队列配置
router.get("/config", QueueController.getConfig);

// 更新队列配置
router.put("/config", 
  ValidationMiddleware.body(QueueValidator.updateConfig),
  QueueController.updateConfig
);

// 重试指定任务
router.post("/tasks/:taskId/retry", 
  ValidationMiddleware.params(QueueValidator.taskIdParam),
  QueueController.retryTask
);

// 取消指定任务
router.delete("/tasks/:taskId", 
  ValidationMiddleware.params(QueueValidator.taskIdParam),
  QueueController.cancelTask
);

// 重试所有失败的任务
router.post("/tasks/retry-all-failed", QueueController.retryAllFailedTasks);

// 清除所有失败的任务
router.delete("/tasks/failed", QueueController.clearFailedTasks);

export default router;
