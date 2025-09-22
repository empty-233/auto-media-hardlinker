import { Router } from "express";
import { TMDBController } from "../controllers/tmdb.controller";
import { TMDBService } from "../services";
import { createValidator } from "../middleware/validation.middleware";
import { ParamValidators, TMDBParamValidators, TMDBQueryValidators } from "../validators";

const tmdbService = TMDBService.getInstance();
const tmdbController = new TMDBController(tmdbService);

const router = Router();

// 多类型搜索（电影+电视剧）
router.get(
  "/search/multi",
  createValidator({
    query: TMDBQueryValidators.search
  }),
  tmdbController.searchMulti
);

// 搜索电影
router.get(
  "/search/movie",
  createValidator({
    query: TMDBQueryValidators.search
  }),
  tmdbController.searchMovies
);

// 搜索电视剧
router.get(
  "/search/tv",
  createValidator({
    query: TMDBQueryValidators.search
  }),
  tmdbController.searchTV
);

// 获取电影详情
router.get(
  "/movie/:id",
  createValidator({
    params: ParamValidators.id,
    query: TMDBQueryValidators.details
  }),
  tmdbController.getMovieInfo
);

// 获取电视剧详情
router.get(
  "/tv/:id",
  createValidator({
    params: ParamValidators.id,
    query: TMDBQueryValidators.details
  }),
  tmdbController.getTvInfo
);

// 获取电视剧季详情
router.get(
  "/tv/:id/season/:season_number",
  createValidator({
    params: TMDBParamValidators.tvSeason,
    query: TMDBQueryValidators.details
  }),
  tmdbController.getSeasonInfo
);

export default router;