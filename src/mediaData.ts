import {
  MovieDb,
  MovieResult,
  TvResult,
  MovieResultsResponse,
  TvResultsResponse,
  SearchCollectionResponse,
  TvSeasonResponse,
  MovieResponse,
  CollectionInfoResponse,
} from "moviedb-promise";
import { getConfig } from "./config";
import { regexConfig } from "../config/regexConfig"; // 从配置文件导入
import fs from "fs";
import path from "path";
import axios from "axios";
import { logger } from "./logger";

const config = getConfig();
const TitleRegExp = regexConfig.TitleRegExps;
const FolderTitleRegExp = regexConfig.FolderTitleRegExps; // 导入文件夹标题正则
const moviedb = new MovieDb(config.tmdbApi);

// TMDB图片基础URL
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/";
// 使用不同尺寸的图片: w92, w154, w185, w342, w500, w780, original
const POSTER_SIZE = "w500";
const BACKDROP_SIZE = "w780";
const STILL_SIZE = "w300"; // 剧集截图尺寸

// 图片存储目录
const IMAGE_DIR = path.join(process.cwd(), "public", "images", "tmdb");

// 确保图片存储目录存在
function ensureImageDirExists() {
  const dirs = [
    path.join(IMAGE_DIR, "posters"),
    path.join(IMAGE_DIR, "backdrops"),
    path.join(IMAGE_DIR, "stills")
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`创建图片目录: ${dir}`);
    }
  });
}

// 初始化图片目录
ensureImageDirExists();

/**
 * 下载并保存TMDB图片
 * @param imagePath TMDB图片路径后缀
 * @param type 图片类型（poster, backdrop, still）
 * @returns 本地保存的图片URL路径或null（如果下载失败）
 */
export async function downloadTMDBImage(imagePath: string | null | undefined, type: 'poster' | 'backdrop' | 'still'): Promise<string | null> {
  if (!imagePath) return null;
  
  try {
    // 选择合适的图片尺寸
    const size = type === 'poster' ? POSTER_SIZE : (type === 'backdrop' ? BACKDROP_SIZE : STILL_SIZE);
    
    // 构建完整的TMDB图片URL
    const imageUrl = `${TMDB_IMAGE_BASE_URL}${size}${imagePath}`;
    
    // 构建本地文件路径（保留原始文件名）
    const fileName = path.basename(imagePath);
    const localDir = path.join(IMAGE_DIR, `${type}s`);
    const localPath = path.join(localDir, fileName);
    
    // 如果文件已经存在，直接返回路径
    if (fs.existsSync(localPath)) {
      logger.debug(`图片已存在，直接返回路径: ${localPath}`);
      return `/images/tmdb/${type}s/${fileName}`;
    }
    
    // 下载图片
    logger.info(`下载TMDB图片: ${imageUrl}`);
    const response = await axios({
      method: 'get',
      url: imageUrl,
      responseType: 'stream'
    });
    
    // 保存图片到本地
    const writer = fs.createWriteStream(localPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        logger.info(`成功保存图片: ${localPath}`);
        resolve(`/images/tmdb/${type}s/${fileName}`);
      });
      writer.on('error', (err) => {
        logger.error(`保存图片失败: ${err.message}`);
        reject(err);
      });
    });
  } catch (error: any) {
    logger.error(`下载TMDB图片失败: ${error.message}`);
    return null;
  }
}

// 媒体类型枚举
// type MediaType = "tv" | "movie" | "collection" | null;

// 为集合结果定义类型
type CollectionResult = {
  id?: number;
  backdrop_path?: string;
  name?: string;
  poster_path?: string;
};

// 基础媒体搜索结果接口
interface BaseMediaSearchResult {
  title: string;
  season?: number;
  episode?: number;
  movieData: MovieResultsResponse;
  tvData: TvResultsResponse;
  collectionData: SearchCollectionResponse;
  isCollection?: boolean;
  collectionContentID?: number[];
  isTheatrical?: boolean;
}

// 电影类型的媒体搜索结果
interface MovieMediaSearchResult extends BaseMediaSearchResult {
  mediaType: "movie";
  selectedData: MovieResult[] | null;
}

// 电视剧类型的媒体搜索结果
interface TvMediaSearchResult extends BaseMediaSearchResult {
  mediaType: "tv";
  selectedData: TvResult[] | null;
}

// 未确定类型的媒体搜索结果
interface NullMediaSearchResult extends BaseMediaSearchResult {
  mediaType: null;
  selectedData: null;
}

// 媒体搜索结果联合类型
type MediaSearchResult =
  | MovieMediaSearchResult
  | TvMediaSearchResult
  | NullMediaSearchResult;

interface MediaInfo {
  title: string;
  season?: number;
  episode?: number;
  year?: number;
}

/**
 * 将常见的中文数字（如“一”, “二”, “十”, “十二”等）转换为阿拉伯数字。
 * 仅支持简单的中文数字表达，适用于一到十几的数字转换。
 *
 * @param chineseNumber - 需要转换的中文数字字符串
 * @returns 转换后的阿拉伯数字，如果无法识别则尝试直接解析为数字
 */
function chineseNumberToArabic(chineseNumber: string): number {
  const chineseNums: { [key: string]: number } = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
    百: 100,
    千: 1000,
  };

  // 简单的中文数字转换，处理常见的一到十几季
  if (chineseNumber === "十") return 10;
  if (chineseNumber.startsWith("十")) {
    return 10 + (chineseNums[chineseNumber[1]] || 0);
  }
  if (chineseNumber.endsWith("十")) {
    return chineseNums[chineseNumber[0]] * 10;
  }
  return chineseNums[chineseNumber] || parseInt(chineseNumber, 10);
}

/**
 * 从给定的标题字符串中提取季数。
 *
 * 遍历配置的正则表达式数组，匹配标题中的季数信息。
 * 如果匹配到中文数字，则会自动转换为阿拉伯数字。
 * 如果匹配到阿拉伯数字，则直接解析为数字类型。
 *
 * @param title 要提取季数的标题字符串
 * @returns 提取到的季数（数字），如果未匹配到则返回 undefined
 */
function extractSeason(title: string): number | undefined {
  for (const regex of regexConfig.seasonRegexps) {
    const seasonMatch = title.match(regex);
    if (seasonMatch && seasonMatch[1]) {
      console.log(seasonMatch);

      // 如果是中文数字，需要转换
      if (/[一二三四五六七八九十百千]/.test(seasonMatch[1])) {
        return chineseNumberToArabic(seasonMatch[1]);
      } else {
        return parseInt(seasonMatch[1], 10);
      }
    }
  }
}

/**
 * 从给定的标题字符串中提取集数信息。
 *
 * 遍历配置中的正则表达式数组，尝试匹配标题中的集数。如果匹配到中文数字，则转换为阿拉伯数字；否则直接解析为整数。
 *
 * @param title 要解析的标题字符串
 * @returns 提取到的集数（数字），如果未能提取则返回 undefined
 */
export function extractEpisode(title: string): number | undefined {
  for (const regex of regexConfig.episodeRegexps) {
    const episodeMatch = title.match(regex);
    if (episodeMatch && episodeMatch[1]) {
      if (/[一二三四五六七八九十百千]/.test(episodeMatch[1])) {
        return chineseNumberToArabic(episodeMatch[1]);
      } else {
        return parseInt(episodeMatch[1], 10);
      }
    }
  }
}

/**
 * 从文件名或文件夹名中提取媒体信息（如标题、年份、季数、集数）。
 *
 * @param filename - 需要解析的文件名或文件夹名。
 * @param isDirectory - 是否为文件夹，默认为 false（即为文件）。
 * @returns 提取到的媒体信息对象，包括标题、年份、季数和集数等。
 * @throws 当无法从文件名或文件夹名中提取到有效的标题或集数时抛出错误。
 *
 * @remarks
 * - 会根据 isDirectory 参数选择不同的正则表达式进行解析。
 * - 对于文件，会尝试移除后缀并提取集数信息；对于文件夹，则只提取标题和季数。
 * - 如果未能识别季数，默认季数为 1，并输出警告。
 */
export function extractMediaInfo(
  filename: string,
  isDirectory: boolean = false
): MediaInfo {
  // 移除非法或不必要的字符，并替换常见分隔符为空格
  let cleanedFilename = filename;

  // 如果不是文件夹，才应用移除后缀的处理
  if (!isDirectory) {
    regexConfig.suffixPatterns.forEach((pattern) => {
      cleanedFilename = filename.replace(pattern, "");
    });
  }

  // 根据是否为文件夹选择合适的正则表达式
  const titleRegexList = isDirectory ? FolderTitleRegExp : TitleRegExp;

  // 提取标题
  for (const titleRegex of titleRegexList) {
    const match = cleanedFilename.match(titleRegex);
    if (match && match.groups && match.groups.title) {
      const title = match.groups.title.trim();
      const year = match.groups.year
        ? parseInt(match.groups.year, 10)
        : undefined;

      // 如果标题为空，抛出错误
      if (!title) {
        throw new Error(
          `从${
            isDirectory ? "文件夹" : "文件"
          }名 "${filename}" 提取的标题为空。使用的正则表达式: ${titleRegex}. 清理后的文件名: "${cleanedFilename}"`
        );
      }
      const result: MediaInfo = { title };
      if (year) result.year = year;

      // 如果正则表达式直接提取了季数（例如"第二季"格式）
      if (match.groups.season) {
        result.season = chineseNumberToArabic(match.groups.season);
      } else {
        const extractedSeason = extractSeason(cleanedFilename);
        if (extractedSeason === undefined) {
          console.warn(`无法确定“ ${cleanedFilename}”的季节。默认为第1季`);
          result.season = 1;
        } else {
          result.season = extractedSeason;
        }
      }

      // 如果是文件夹，可能不需要提取季集数信息，或者使用不同的提取逻辑
      if (!isDirectory) {
        const episode = extractEpisode(cleanedFilename);
        if (!episode) throw new Error(`无法从文件名 "${filename}" 提取集数`);
        result.episode = episode;
      }
      // else {
      //   result.season = extractSeason(cleanedFilename);
      // }
      return result;
    }
  }
  throw new Error(
    `无法从${isDirectory ? "文件夹" : "文件"}名 "${filename}" 提取标题`
  );
}

/**
 * 计算两个标题字符串的相似度。
 *
 * 此函数首先将标题转换为小写，并检查其中一个标题是否包含另一个标题，
 * 若包含则返回较高的相似度（0.8）。否则，使用简单的编辑距离算法（逐字符比较）
 * 估算两个标题的差异，并根据最大长度归一化为0~1之间的相似度分数。
 *
 * @param title1 - 第一个标题字符串
 * @param title2 - 第二个标题字符串
 * @returns 两个标题的相似度分数，范围为0（完全不同）到1（完全相同）
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  if (!title1 || !title2) {
    return 0; // 如果任一标题为空，返回0相似度
  }

  const t1 = title1.toLowerCase();
  const t2 = title2.toLowerCase();

  // 简单的包含关系检查
  if (t2.includes(t1) || t1.includes(t2)) {
    return 0.8; // 高相似度
  }

  // 简单的编辑距离估算 - 使用字符数组支持Unicode字符
  const t1Chars = [...t1];
  const t2Chars = [...t2];
  let distance = 0;
  const maxLength = Math.max(t1Chars.length, t2Chars.length);
  const minLength = Math.min(t1Chars.length, t2Chars.length);

  for (let i = 0; i < minLength; i++) {
    if (t1Chars[i] !== t2Chars[i]) {
      distance++;
    }
  }

  distance += maxLength - minLength;

  // 避免除以0的情况
  return maxLength > 0 ? 1 - distance / maxLength : 0;
}

/**
 * 根据提供的影视数据和文件名信息，智能判断媒体类型（电影、电视剧或系列电影）。
 *
 * 决策逻辑包括：
 * 1. 如果存在季/集信息且有电视剧结果，优先判定为电视剧。
 * 2. 如果文件名包含“剧场版”等标记且有电影结果，优先判定为电影，并标记为剧场版。
 * 3. 如果同时有电影和电视剧结果，通过标题相似度判断更接近哪一类，并进一步判断是否为系列电影。
 * 4. 如果找到了集合（系列电影），则判定为集合类型。
 * 5. 仅有电影结果时，判断是否为系列电影。
 * 6. 仅有电视剧结果时，判定为电视剧。
 * 7. 若无法确定类型，则返回初始结果。
 *
 * @param tvData 电视剧搜索结果
 * @param movieData 电影搜索结果
 * @param collectionData 系列电影集合搜索结果
 * @param mediaInfo 解析自文件名的媒体信息（如标题、季、集等）
 * @param fileName 原始文件名
 * @returns 智能判定后的媒体搜索结果对象，包含类型、选中数据及相关标记
 */
function determineMediaType(
  tvData: TvResultsResponse,
  movieData: MovieResultsResponse,
  collectionData: SearchCollectionResponse,
  mediaInfo: MediaInfo,
  fileName: string
): MediaSearchResult {
  const movieResults = movieData.results || [];
  const tvResults = tvData.results || [];
  const collectionResults = collectionData.results || [];

  // 初始化基础结果对象
  const baseResult: BaseMediaSearchResult = {
    title: mediaInfo.title,
    season: mediaInfo.season,
    episode: mediaInfo.episode,
    movieData,
    tvData,
    collectionData,
  };

  // 检查电视剧和电影结果
  const hasMovieResults = movieResults.length > 0;
  const hasTvResults = tvResults.length > 0;

  // 检查关键特征
  const hasSeasonEpisode =
    mediaInfo.season !== undefined || mediaInfo.episode !== undefined;
  const isTheatricalVersion = /剧场版|theatrical|OVA|ova|movie/i.test(fileName);

  // 如果有季集信息，优先判定为电视剧
  if (hasSeasonEpisode && hasTvResults) {
    return {
      ...baseResult,
      mediaType: "tv",
      selectedData: tvResults,
    };
  }

  // 如果是剧场版标记，优先判定为电影
  if (isTheatricalVersion && hasMovieResults) {
    return {
      ...baseResult,
      mediaType: "movie",
      selectedData: movieResults,
      isTheatrical: true,
    };
  }

  // 如果有两种结果，比较标题相似度
  if (hasMovieResults && hasTvResults) {
    const topMovie = movieResults[0];
    const topTv = tvResults[0];

    const movieTitleSimilarity = calculateTitleSimilarity(
      mediaInfo.title,
      topMovie.title || ""
    );
    const tvTitleSimilarity = calculateTitleSimilarity(
      mediaInfo.title,
      topTv.name || ""
    );

    console.log(
      `电影标题相似度: ${movieTitleSimilarity.toFixed(
        2
      )}, 电视剧标题相似度: ${tvTitleSimilarity.toFixed(2)}`
    );

    if (movieTitleSimilarity > tvTitleSimilarity) {
      return {
        ...baseResult,
        mediaType: "movie",
        selectedData: movieResults,
      };
    } else {
      return {
        ...baseResult,
        mediaType: "tv",
        selectedData: tvResults,
      };
    }
  }

  // 检查是否找到了集合
  if (collectionResults.length > 0) {
    console.log("找到系列电影集合:", collectionResults[0].name);
    const id = collectionResults[0].id;
    if (!id) throw new Error("collection id为空");

    moviedb
      .collectionInfo({ id, language: config.language })
      .then((collectionResponse) => {
        const collectionContentID: number[] = [];
        collectionResponse.parts?.forEach((part) => {
          if (movieResults.some((movie) => movie.id === part.id) && part.id) {
            collectionContentID.push(part.id);
          }
        });
        baseResult.isCollection = true;
        baseResult.collectionContentID = collectionContentID;
      })
      .catch((error) => {
        console.error("获取集合信息失败：", error);
      });
  }

  // 只有电影结果
  if (hasMovieResults) {
    return {
      ...baseResult,
      mediaType: "movie",
      selectedData: movieResults,
    };
  }

  // 只有电视剧结果
  if (hasTvResults) {
    return {
      ...baseResult,
      mediaType: "tv",
      selectedData: tvResults,
    };
  }

  // 无法确定类型
  return {
    ...baseResult,
    mediaType: null,
    selectedData: null,
  };
}

interface SearchTMDBData {
  mediaInfo: MediaInfo;
  data: MediaSearchResult;
}

/**
 * 根据文件名（或文件夹名）从 TMDB 搜索对应的媒体数据（电影、电视剧或合集）。
 *
 * @param fileName - 需要解析和搜索的文件名或文件夹名。
 * @param isDirectory - 指示 fileName 是否为文件夹名，默认为 false。
 * @returns 返回一个 Promise，解析为包含媒体信息和 TMDB 搜索结果的对象。
 *
 * @throws 当无法从文件名或文件夹名中提取有效标题时抛出错误。
 *
 * @remarks
 * 该函数会先通过 extractMediaInfo 提取媒体信息，然后并发搜索 TMDB 的电影、电视剧和合集数据，
 * 最后根据搜索结果和提取的信息判断媒体类型并返回。
 */
export function searchTMDBData(
  fileName: string,
  isDirectory: boolean = false
): Promise<SearchTMDBData> {
  return new Promise(async (resolve, reject) => {
    const parameters = {
      query: "",
      language: config.language,
    };
    let mediaInfo: MediaInfo;

    try {
      mediaInfo = extractMediaInfo(fileName, isDirectory);
      console.log(
        `提取的${isDirectory ? "文件夹" : "文件"}媒体信息：`,
        mediaInfo
      );

      parameters.query = mediaInfo.title;

      // 如果有季数信息，可以用于后续处理（例如，查找特定季的剧集）
      const seasonInfo = mediaInfo.season ? `第${mediaInfo.season}季` : "";
      const episodeInfo = mediaInfo.episode ? `第${mediaInfo.episode}集` : "";
      if (seasonInfo || episodeInfo) {
        console.log(`检测到剧集信息: ${seasonInfo} ${episodeInfo}`);
      }
    } catch (error) {
      return reject(
        new Error(
          `无法从${
            isDirectory ? "文件夹" : "文件"
          }名 "${fileName}" 提取有效标题`
        )
      );
    }

    try {
      // 同时搜索电影和电视剧
      const [tvResponse, movieResponse, collectionResponse] = await Promise.all(
        [
          moviedb.searchTv(parameters).catch(() => ({ results: [] })),
          moviedb.searchMovie(parameters).catch(() => ({ results: [] })),
          moviedb.searchCollection(parameters).catch(() => ({ results: [] })),
        ]
      );

      // 处理搜索结果，判断媒体类型
      const result = determineMediaType(
        tvResponse as TvResultsResponse,
        movieResponse as MovieResultsResponse,
        collectionResponse as SearchCollectionResponse,
        mediaInfo,
        fileName
      );
      console.log(`媒体类型判断结果: ${result.mediaType}`);
      resolve({ mediaInfo, data: result });
    } catch (error) {
      console.error("TMDB 搜索失败：", { error, parameters });
      reject(error);
    }
  });
}

export type TMDBData =
  | {
      title: string;
      info: MediaSearchResult;
      episodeTitle?: string;
      episode?: number;
      season?: number;
      data: TvSeasonResponse;
      type: "tv";
    }
  | {
      title: string;
      info: MediaSearchResult;
      episodeTitle?: string;
      episode?: number;
      data: MovieResponse;
      type: "movie";
    };

/**
 * 根据文件名或父文件夹名称从 TMDB 检索媒体信息（电影、电视剧）。
 *
 * @param fileName - 需要检索的文件名。
 * @param isDirectory - 是否为目录（true 表示目录，false 表示文件）。
 * @param fullPath - （可选）文件的完整路径，用于在文件名检索失败时从父文件夹提取信息。
 * @returns 返回一个 Promise，解析为 TMDBData 对象，包含媒体的详细信息。
 *
 * @throws 当检索到多个内容、无法获取媒体ID、无法确定媒体类型或提取集数信息失败时抛出错误。
 *
 * @remarks
 * 1. 优先尝试从文件名提取媒体信息，若失败则尝试从父文件夹名称提取。
 * 2. 支持电影、电视剧（含季/集信息）2种类型的媒体。
 * 3. 对于电视剧文件，若为单集文件，会尝试提取集数并补充集标题信息。
 */
export function RetrieveTMDBInfo(
  fileName: string,
  isDirectory: boolean,
  fullPath?: string
): Promise<TMDBData> {
  return new Promise(async (resolve, reject) => {
    // 处理查询结果的函数
    const processSearchResult = (TMDBData: SearchTMDBData) => {
      console.log("TMDB 数据：", TMDBData.data);
      if (
        !TMDBData.data.selectedData ||
        TMDBData.data.selectedData.length === 0 ||
        TMDBData.data.selectedData.length > 1
      ) {
        return reject(new Error("多个内容，请选择其中一个"));
      }

      const id = TMDBData.data.selectedData[0].id;
      if (!id) return reject(new Error("无法获取媒体ID"));

      switch (TMDBData.data.mediaType) {
        case "tv":
          // 获取季节信息
          moviedb
            .seasonInfo({
              id,
              season_number: TMDBData.data.season ?? 1,
              language: config.language,
            })
            .then((tvResponse) => {
              const result: TMDBData = {
                title: TMDBData.data.title,
                info: TMDBData.data,
                season: TMDBData.data.season,
                data: tvResponse,
                type: "tv",
              };

              // 设置标题
              // if (
              //   TMDBData.data.selectedData &&
              //   TMDBData.data.selectedData.length > 0
              // ) {
              //   const selectedItem = TMDBData.data.selectedData[0];
              //   if ("name" in selectedItem) {
              //     result.title = selectedItem.name as string;
              //   }
              // }

              // 设置集信息
              if (
                !isDirectory &&
                tvResponse.episodes &&
                TMDBData.mediaInfo.episode &&
                tvResponse.episodes[TMDBData.mediaInfo.episode - 1]
              ) {
                result.episodeTitle =
                  tvResponse.episodes[TMDBData.mediaInfo.episode - 1].name;
                result.episode = TMDBData.mediaInfo.episode;
              }

              resolve(result);
            })
            .catch((error) => {
              console.error("获取季节信息失败：", error);
              reject(error);
            });
          break;

        case "movie":
          moviedb
            .movieInfo({ id, language: config.language })
            .then((movieResponse) => {
              const result: TMDBData = {
                title: TMDBData.data.title,
                info: TMDBData.data,
                data: movieResponse,
                type: "movie",
              };
              resolve(result);
            })
            .catch((error) => {
              console.error("获取电影信息失败：", error);
            });
          break;

        default:
          throw new Error("无法确定媒体类型");
      }
    };

    // 尝试提取集数信息的函数
    const extractEpisodeInfo = (
      result: TMDBData,
      originalFileName: string
    ): TMDBData => {
      const episode = extractEpisode(originalFileName);
      if (!episode) throw new Error("无法从原始文件名提取集数信息");
      result.episode = episode;
      if (result.type === "tv")
        if (result.data.episodes && episode - 1 < result.data.episodes.length) {
          result.episodeTitle = result.data.episodes[episode - 1].name;
        }
      return result;
    };

    // 主要逻辑流程
    try {
      // 先尝试从文件名提取信息
      const data = await searchTMDBData(fileName, isDirectory);
      processSearchResult(data);
    } catch (error) {
      // 文件名提取失败，尝试从父文件夹提取
      if (!isDirectory && fullPath) {
        console.log(`从文件名提取失败，尝试从父文件夹提取: ${fullPath}`);
        const path = require("path");
        const parentDir = path.basename(path.dirname(fullPath));

        if (parentDir) {
          console.log(`尝试从父文件夹名称提取: ${parentDir}`);
          // 从父文件夹提取信息
          RetrieveTMDBInfo(parentDir, true)
            .then((result) => {
              // 保留原始文件的集数信息
              resolve(extractEpisodeInfo(result, fileName));
            })
            .catch((parentError) => {
              console.error("从父文件夹提取也失败:", parentError);
              reject(error); // 返回原始错误
            });
        } else {
          reject(error);
        }
      } else {
        reject(error);
      }
    }
  });
}

/**
 * 获取媒体项的名称。
 *
 * 根据传入的媒体项类型（电影、电视剧或合集），优先返回 `name` 字段，
 * 如果没有则返回 `title` 字段。如果都没有则返回 `undefined`。
 *
 * @param mediaItem 电影、电视剧或合集的结果对象
 * @returns 媒体项的名称，或 `undefined` 如果没有可用名称
 */
export function getMediaName(
  mediaItem: MovieResult | TvResult | CollectionResult
): string | undefined {
  if ("name" in mediaItem) {
    return mediaItem.name;
  } else if ("title" in mediaItem) {
    return mediaItem.title;
  }
  return undefined;
}

/**
 * 根据媒体类型获取正确的发布日期
 * @param mediaItem 媒体项目数据
 * @param mediaType 媒体类型
 * @returns 发布日期或null
 */
export function getMediaReleaseDate(
  media: any,
  type: string | null
): Date | null {
  if (!media) return null;

  let dateString: string | undefined;

  if (type === "movie") {
    dateString = media.release_date;
  } else if (type === "tv") {
    dateString = media.first_air_date;
  }

  // 如果日期字符串存在，转换为标准 Date 对象
  if (dateString) {
    return new Date(dateString);
  }

  return null;
}
