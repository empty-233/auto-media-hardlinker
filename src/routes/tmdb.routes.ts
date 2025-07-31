import { Router } from "express";
import { TMDBController } from "../controllers/tmdb.controller";

const router = Router();

// 多类型搜索（电影+电视剧）
router.get("/search/multi", TMDBController.searchMulti);

// 搜索电影
router.get("/search/movie", TMDBController.searchMovies);

// 搜索电视剧
router.get("/search/tv", TMDBController.searchTV);

// 获取电影详情
router.get("/movie/:id", TMDBController.getMovieInfo);

// 获取电视剧详情
router.get("/tv/:id", TMDBController.getTvInfo);

// 获取电视剧季详情
router.get("/tv/:id/season/:season_number", TMDBController.getSeasonInfo);

export default router;
