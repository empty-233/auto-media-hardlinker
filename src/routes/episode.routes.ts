import { Router } from "express";
import { EpisodeController } from "../controllers";

const router = Router();

// 更新剧集信息
router.put("/:id", EpisodeController.updateEpisode);

export default router;
