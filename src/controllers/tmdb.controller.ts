import { Request, Response } from "express";
import { logger } from "../utils/logger";
import { success, internalError } from "../utils/response";
import { tmdbService } from "../services/tmdb.service";
import { SearchMovieRequest, SearchTvRequest } from "moviedb-promise";

export class TMDBController {
  // 多类型搜索（电影+电视剧）
  static async searchMulti(req: Request, res: Response) {
    try {
      // 使用验证中间件验证后的数据
      const { query, page, language, include_adult } = req.query as any;

      const searchParams = {
        query: query as string,
        page: page as number,
        language: language as string,
        include_adult: include_adult as boolean
      };

      const result = await tmdbService.searchMulti(searchParams);
      
      logger.info(`TMDB多类型搜索成功: ${query}, 结果数量: ${result.results?.length || 0}`);
      success(res, result, "搜索成功");
    } catch (error) {
      logger.error(`TMDB多类型搜索失败`, error);
      internalError(res, "搜索失败，请稍后重试");
    }
  }

  // 搜索电影
  static async searchMovies(req: Request, res: Response) {
    try {
      // 使用验证中间件验证后的数据
      const { query, page, language, include_adult, year, primary_release_year } = req.query as any;

      const searchParams: SearchMovieRequest = {
        query: query as string,
        page: page as number,
        language: language as string,
        include_adult: include_adult as boolean
      };

      if (year) searchParams.year = year;
      if (primary_release_year) searchParams.primary_release_year = primary_release_year;

      const result = await tmdbService.searchMovies(searchParams);
      
      logger.info(`TMDB电影搜索成功: ${query}, 结果数量: ${result.results?.length || 0}`);
      success(res, result, "搜索成功");
    } catch (error) {
      logger.error(`TMDB电影搜索失败`, error);
      internalError(res, "搜索失败，请稍后重试");
    }
  }

  // 搜索电视剧
  static async searchTV(req: Request, res: Response) {
    try {
      // 使用验证中间件验证后的数据
      const { query, page, language, include_adult, first_air_date_year } = req.query as any;

      const searchParams: SearchTvRequest = {
        query: query as string,
        page: page as number,
        language: language as string,
        include_adult: include_adult as boolean
      };

      if (first_air_date_year) searchParams.first_air_date_year = first_air_date_year;

      const result = await tmdbService.searchTV(searchParams);
      
      logger.info(`TMDB电视剧搜索成功: ${query}, 结果数量: ${result.results?.length || 0}`);
      success(res, result, "搜索成功");
    } catch (error) {
      logger.error(`TMDB电视剧搜索失败`, error);
      internalError(res, "搜索失败，请稍后重试");
    }
  }

  // 获取电影详情
  static async getMovieInfo(req: Request, res: Response) {
    try {
      // 使用验证中间件验证后的数据
      const { id } = req.params as any;
      const { language, append_to_response } = req.query as any;

      const result = await tmdbService.getMovieInfo(
        id,
        language,
        append_to_response
      );
      
      logger.info(`获取TMDB电影详情成功: ${id}`);
      success(res, result, "获取详情成功");
    } catch (error) {
      logger.error(`获取TMDB电影详情失败`, error);
      internalError(res, "获取详情失败，请稍后重试");
    }
  }

  // 获取电视剧详情
  static async getTvInfo(req: Request, res: Response) {
    try {
      // 使用验证中间件验证后的数据
      const { id } = req.params as any;
      const { language, append_to_response } = req.query as any;

      const result = await tmdbService.getTvInfo(
        id,
        language,
        append_to_response
      );
      
      logger.info(`获取TMDB电视剧详情成功: ${id}`);
      success(res, result, "获取详情成功");
    } catch (error) {
      logger.error(`获取TMDB电视剧详情失败`, error);
      internalError(res, "获取详情失败，请稍后重试");
    }
  }

  // 获取电视剧季详情
  static async getSeasonInfo(req: Request, res: Response) {
    try {
      // 使用验证中间件验证后的数据
      const { id, season_number } = req.params as any;
      const { language, append_to_response } = req.query as any;

      const result = await tmdbService.getSeasonInfo(
        id,
        season_number,
        language,
        append_to_response
      );
      
      logger.info(`获取TMDB电视剧季详情成功: ${id} S${season_number}`);
      success(res, result, "获取详情成功");
    } catch (error) {
      logger.error(`获取TMDB电视剧季详情失败`, error);
      internalError(res, "获取详情失败，请稍后重试");
    }
  }
}

export default TMDBController;
