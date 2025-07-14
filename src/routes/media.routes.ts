import { Router } from "express";
import { MediaController } from "../controllers";

const router = Router();

// 获取所有媒体列表
router.get("/", MediaController.getAllMedia);

// 获取单个媒体详情
router.get("/:id", MediaController.getMediaById);

// 按类型获取媒体
router.get("/type/:type", MediaController.getMediaByType);

export default router;
