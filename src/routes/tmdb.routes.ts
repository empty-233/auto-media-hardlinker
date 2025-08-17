import { Router } from "express";
import { TMDBController } from "../controllers/tmdb.controller";
import { TMDBService } from "../services";

const tmdbService = TMDBService.getInstance();
const tmdbController = new TMDBController(tmdbService);

const router = Router();

// 多类型搜索（电影+电视剧）
router.get("/search/multi", tmdbController.searchMulti);

// 搜索电影
router.get("/search/movie", tmdbController.searchMovies);

// 搜索电视剧
router.get("/search/tv", tmdbController.searchTV);

// 获取电影详情
router.get("/movie/:id", tmdbController.getMovieInfo);

// 获取电视剧详情
router.get("/tv/:id", tmdbController.getTvInfo);

// 获取电视剧季详情
router.get("/tv/:id/season/:season_number", tmdbController.getSeasonInfo);

export default router;
