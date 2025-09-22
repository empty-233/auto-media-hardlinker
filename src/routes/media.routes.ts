import { Router } from "express";
import { MediaController } from "../controllers";
import { MediaService } from "../services";
import { createValidator } from "../middleware/validation.middleware";
import { MediaParamValidators, MediaQueryValidators, ParamValidators } from "../validators";

const mediaService = new MediaService();
const mediaController = new MediaController(mediaService);

const router = Router();

// 获取所有媒体列表
router.get(
  "/",
  createValidator({
    query: MediaQueryValidators.list
  }),
  mediaController.getAllMedia
);

// 获取单个媒体详情
router.get(
  "/:id",
  createValidator({
    params: ParamValidators.id
  }),
  mediaController.getMediaById
);

// 按类型获取媒体
router.get(
  "/type/:type",
  createValidator({
    params: MediaParamValidators.type,
    query: MediaQueryValidators.list
  }),
  mediaController.getMediaByType
);

export default router;