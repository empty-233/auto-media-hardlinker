import { Router } from "express";
import { SystemController } from "../controllers";
import { ValidationMiddleware, SystemValidator } from "../validators";

const router = Router();

// 获取系统日志
router.get("/logs", SystemController.getLogs);

// 获取系统配置
router.get("/config", SystemController.getConfig);

// 更新系统配置
router.put(
  "/config",
  ValidationMiddleware.body(SystemValidator.updateConfig),
  SystemController.updateConfig
);

export default router;
