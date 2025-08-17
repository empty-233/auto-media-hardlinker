import { Router } from "express";
import { SystemController } from "../controllers";
import { SystemService } from "../services";
import { ValidationMiddleware, SystemValidator } from "../validators";

const systemService = new SystemService();
const systemController = new SystemController(systemService);

const router = Router();

// 获取系统日志
router.get("/logs", systemController.getLogs);

// 获取系统配置
router.get("/config", systemController.getConfig);

// 更新系统配置
router.put(
  "/config",
  ValidationMiddleware.body(SystemValidator.updateConfig),
  systemController.updateConfig
);

export default router;
