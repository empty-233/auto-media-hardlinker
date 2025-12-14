import { getConfig } from "@/config/config";
import {
  MovieDb,
  SearchMovieRequest,
  SearchTvRequest,
  MovieResponse,
  ShowResponse, // 使用正确的 ShowResponse 类型
  TvSeasonResponse,
  SearchMultiRequest,
  IdAppendToResponseRequest, // 导入请求参数类型
  TvSeasonRequest, // 导入季详情请求参数类型
} from "moviedb-promise";
import { logger } from "@/utils/logger";

const config = getConfig();

/**
 * TMDB 服务类
 * 封装了与 The Movie Database (TMDB) API 的所有交互。
 */
export class TMDBService {
  private static instance: TMDBService;
  private moviedb: MovieDb;

  private constructor() {
    this.moviedb = new MovieDb(config.tmdbApi);
    logger.info("TMDB服务已初始化");
  }

  public static getInstance(): TMDBService {
    if (!TMDBService.instance) {
      TMDBService.instance = new TMDBService();
    }
    return TMDBService.instance;
  }

  /**
   * 多类型搜索（电影、电视剧、人物）
   * @param params - 搜索参数
   * @returns 搜索结果
   */
  async searchMulti(params: SearchMultiRequest) {
    logger.info(`使用参数进行TMDB多类型搜索: ${JSON.stringify(params)}`);
    return this.moviedb.searchMulti(params);
  }

  /**
   * 搜索电影
   * @param params - 电影搜索参数
   * @returns 电影搜索结果
   */
  async searchMovies(params: SearchMovieRequest) {
    logger.info(`使用参数进行TMDB电影搜索: ${JSON.stringify(params)}`);
    return this.moviedb.searchMovie(params);
  }

  /**
   * 搜索电视剧
   * @param params - 电视剧搜索参数
   * @returns 电视剧搜索结果
   */
  async searchTV(params: SearchTvRequest) {
    logger.info(`使用参数进行TMDB电视剧搜索: ${JSON.stringify(params)}`);
    return this.moviedb.searchTv(params);
  }

  /**
   * 获取电影详情
   * @param id - 电影的 TMDB ID
   * @param language - 语言
   * @param append_to_response - 附加响应数据，例如 'credits,videos'
   * @returns 电影详情
   */
  async getMovieInfo(
    id: number,
    language: string = "zh-CN",
    append_to_response?: string
  ): Promise<MovieResponse> {
    const params: IdAppendToResponseRequest = { id, language };
    if (append_to_response) {
      params.append_to_response = append_to_response;
    }
    logger.info(`从TMDB获取电影详情，ID: ${id}`);
    return this.moviedb.movieInfo(params);
  }

  /**
   * 获取电视剧详情
   * @param id - 电视剧的 TMDB ID
   * @param language - 语言
   * @param append_to_response - 附加响应数据
   * @returns 电视剧详情
   */
  async getTvInfo(
    id: number,
    language: string = "zh-CN",
    append_to_response?: string
  ): Promise<ShowResponse> {
    const params: IdAppendToResponseRequest = { id, language };
    if (append_to_response) {
      params.append_to_response = append_to_response;
    }
    logger.info(`从TMDB获取电视剧详情，ID: ${id}`);
    return this.moviedb.tvInfo(params);
  }

  /**
   * 获取电视剧季详情
   * @param tvId - 电视剧的 TMDB ID
   * @param seasonNumber - 季号
   * @param language - 语言
   * @param append_to_response - 附加响应数据
   * @returns 电视剧季详情
   */
  async getSeasonInfo(
    tvId: number,
    seasonNumber: number,
    language: string = "zh-CN",
    append_to_response?: string
  ): Promise<TvSeasonResponse> {
    const params: TvSeasonRequest = {
      id: tvId,
      season_number: seasonNumber,
      language,
    };
    if (append_to_response) {
      params.append_to_response = append_to_response;
    }
    logger.info(
      `从TMDB获取电视剧季详情，电视剧ID: ${tvId}, 季: ${seasonNumber}`
    );
    return this.moviedb.seasonInfo(params);
  }
}