import { Router } from "express";
import { EpisodeController } from "../controllers";
import { 
  ValidationMiddleware,
  EpisodeValidators,
  EpisodeParamValidators
} from "../validators";

const router = Router();

// 更新剧集信息
router.put(
  "/:id", 
  ValidationMiddleware.params(EpisodeParamValidators.episodeId),
  ValidationMiddleware.body(EpisodeValidators.updateEpisode),
  EpisodeController.updateEpisode
);

export default router;
