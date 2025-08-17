import { Router } from "express";
import { EpisodeController } from "../controllers";
import { EpisodeService, TMDBService } from "../services";
import {
  ValidationMiddleware,
  EpisodeValidators,
  EpisodeParamValidators
} from "../validators";

const tmdbService = TMDBService.getInstance();
const episodeService = new EpisodeService(tmdbService);
const episodeController = new EpisodeController(episodeService);

const router = Router();

// 更新剧集信息
router.put(
  "/:id",
  ValidationMiddleware.params(EpisodeParamValidators.episodeId),
  ValidationMiddleware.body(EpisodeValidators.updateEpisode),
  episodeController.updateEpisode
);

export default router;
