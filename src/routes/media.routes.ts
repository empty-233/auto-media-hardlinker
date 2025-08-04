import { Router } from "express";
import { z } from "zod";
import { MediaController } from "../controllers";
import { 
  ValidationMiddleware,
  MediaQueryValidators,
  ParamValidators,
  CommonValidators
} from "../validators";

const router = Router();

// 获取所有媒体列表
router.get(
  "/", 
  ValidationMiddleware.query(MediaQueryValidators.getMediaList),
  MediaController.getAllMedia
);

// 获取单个媒体详情
router.get(
  "/:id", 
  ValidationMiddleware.params(ParamValidators.id),
  MediaController.getMediaById
);

// 按类型获取媒体
router.get(
  "/type/:type", 
  ValidationMiddleware.params(z.object({ type: CommonValidators.mediaType })),
  ValidationMiddleware.query(MediaQueryValidators.getMediaList),
  MediaController.getMediaByType
);

export default router;
