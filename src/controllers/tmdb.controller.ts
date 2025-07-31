import { Request, Response } from "express";
import { logger } from "../utils/logger";
import { success, badRequest, internalError } from "../utils/response";
import { tmdbService } from "../services/tmdb.service";
import { SearchMovieRequest, SearchTvRequest } from "moviedb-promise";

export class TMDBController {
  // 多类型搜索（电影+电视剧）
  static async searchMulti(req: Request, res: Response) {
    try {
      const { query, page = 1, language = 'zh-CN', include_adult = false } = req.query;
      
      if (!query || typeof query !== 'string') {
        badRequest(res, "搜索关键词不能为空");
        return;
      }

      const searchParams = {
        query: query as string,
        page: parseInt(page as string) || 1,
        language: language as string,
        include_adult: include_adult === 'true'
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
      const { query, page = 1, language = 'zh-CN', include_adult = false, year, primary_release_year } = req.query;
      
      if (!query || typeof query !== 'string') {
        badRequest(res, "搜索关键词不能为空");
        return;
      }

      const searchParams: SearchMovieRequest = {
        query: query as string,
        page: parseInt(page as string) || 1,
        language: language as string,
        include_adult: include_adult === 'true'
      };

      if (year) searchParams.year = parseInt(year as string);
      if (primary_release_year) searchParams.primary_release_year = parseInt(primary_release_year as string);

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
      const { query, page = 1, language = 'zh-CN', include_adult = false, first_air_date_year } = req.query;
      
      if (!query || typeof query !== 'string') {
        badRequest(res, "搜索关键词不能为空");
        return;
      }

      const searchParams: SearchTvRequest = {
        query: query as string,
        page: parseInt(page as string) || 1,
        language: language as string,
        include_adult: include_adult === 'true'
      };

      if (first_air_date_year) searchParams.first_air_date_year = parseInt(first_air_date_year as string);

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
      const { id } = req.params;
      const { language = 'zh-CN', append_to_response } = req.query;

      if (!id) {
        badRequest(res, "电影ID不能为空");
        return;
      }

      const result = await tmdbService.getMovieInfo(
        parseInt(id),
        language as string,
        append_to_response as string | undefined
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
      const { id } = req.params;
      const { language = 'zh-CN', append_to_response } = req.query;

      if (!id) {
        badRequest(res, "电视剧ID不能为空");
        return;
      }

      const result = await tmdbService.getTvInfo(
        parseInt(id),
        language as string,
        append_to_response as string | undefined
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
      const { id, season_number } = req.params;
      const { language = 'zh-CN', append_to_response } = req.query;

      if (!id || !season_number) {
        badRequest(res, "电视剧ID和季号不能为空");
        return;
      }

      const result = await tmdbService.getSeasonInfo(
        parseInt(id),
        parseInt(season_number),
        language as string,
        append_to_response as string | undefined
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
