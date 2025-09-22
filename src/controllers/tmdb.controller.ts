import { Response } from "express";
import { success } from "../utils/response";
import { TMDBService } from "../services";
import { TypedController, TypedRequest } from "./base.controller";
import {
  TMDBQueryValidators,
  TMDBParamValidators,
  ParamValidators,
} from "../validators";
import { logger } from "../utils/logger";
import { z } from "zod";
import { SearchMovieRequest, SearchTvRequest } from "moviedb-promise";

// 类型推导
type SearchQuery = z.infer<typeof TMDBQueryValidators.search>;
type TvSeasonParam = z.infer<typeof TMDBParamValidators.tvSeason>;
type IdParam = z.infer<typeof ParamValidators.id>;

// TMDB控制器
export class TMDBController extends TypedController {
  constructor(private tmdbService: TMDBService) {
    super();
  }

  // 多类型搜索（电影+电视剧）
  searchMulti = this.asyncHandler(
    async (req: TypedRequest<{}, SearchQuery>, res: Response) => {
      const { query, page, language } = req.query;

      const searchParams = {
        query,
        page,
        language,
        include_adult: true,
      };

      const result = await this.tmdbService.searchMulti(searchParams);

      logger.info(
        `TMDB多类型搜索成功: ${query}, 结果数量: ${result.results?.length || 0}`
      );
      success(res, result, "搜索成功");
    }
  );

  // 搜索电影
  searchMovies = this.asyncHandler(
    async (req: TypedRequest<{}, SearchQuery>, res: Response) => {
      const { query, page, language } = req.query;

      const searchParams: SearchMovieRequest = {
        query,
        page,
        language,
        include_adult: true,
      };

      const result = await this.tmdbService.searchMovies(searchParams);

      logger.info(
        `TMDB电影搜索成功: ${query}, 结果数量: ${result.results?.length || 0}`
      );
      success(res, result, "搜索成功");
    }
  );

  // 搜索电视剧
  searchTV = this.asyncHandler(
    async (req: TypedRequest<{}, SearchQuery>, res: Response) => {
      const { query, page, language } = req.query;

      const searchParams: SearchTvRequest = {
        query,
        page,
        language,
        include_adult: true,
      };

      const result = await this.tmdbService.searchTV(searchParams);

      logger.info(
        `TMDB电视剧搜索成功: ${query}, 结果数量: ${result.results?.length || 0}`
      );
      success(res, result, "搜索成功");
    }
  );

  // 获取电影详情
  getMovieInfo = this.asyncHandler(
    async (req: TypedRequest<IdParam>, res: Response) => {
      const { id } = req.params;
      const { language, append_to_response } = req.query;

      const result = await this.tmdbService.getMovieInfo(
        id,
        language,
        append_to_response
      );

      logger.info(`获取TMDB电影详情成功: ${id}`);
      success(res, result, "获取详情成功");
    }
  );

  // 获取电视剧详情
  getTvInfo = this.asyncHandler(
    async (req: TypedRequest<IdParam>, res: Response) => {
      const { id } = req.params;
      const { language, append_to_response } = req.query;

      const result = await this.tmdbService.getTvInfo(
        id,
        language,
        append_to_response
      );

      logger.info(`获取TMDB电视剧详情成功: ${id}`);
      success(res, result, "获取详情成功");
    }
  );

  // 获取电视剧季详情
  getSeasonInfo = this.asyncHandler(
    async (req: TypedRequest<TvSeasonParam>, res: Response) => {
      const { id, season_number } = req.params;
      const { language, append_to_response } = req.query;

      const result = await this.tmdbService.getSeasonInfo(
        id,
        season_number,
        language,
        append_to_response
      );

      logger.info(`获取TMDB电视剧季详情成功: ${id} S${season_number}`);
      success(res, result, "获取详情成功");
    }
  );
}
