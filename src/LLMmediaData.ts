import { Ollama } from "ollama";
import fs from "fs";
import path from "path";
import { getConfig } from "./config";
import { logger } from "./logger";
import { extractMediaInfo, extractEpisode, downloadTMDBImage } from "./mediaData";

// 导入类型和TMDB API
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

// 配置
const config = getConfig();

// 创建TMDB API客户端
const moviedb = new MovieDb(config.tmdbApi);

// LLM 配置
const filePath = path.join(__dirname, "..", "config", "prompt.md");
const prompt = fs.readFileSync(filePath, "utf8");
const ollama = new Ollama({ host: config.llmHost || "http://localhost:11434" });
const LLM_MODEL = config.llmModel || "qwen2.5";

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

interface MovieMediaSearchResult extends BaseMediaSearchResult {
  mediaType: "movie";
  selectedData: MovieResult[] | null;
}

interface TvMediaSearchResult extends BaseMediaSearchResult {
  mediaType: "tv";
  selectedData: TvResult[] | null;
}

interface NullMediaSearchResult extends BaseMediaSearchResult {
  mediaType: null;
  selectedData: null;
}

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

interface SearchTMDBData {
  mediaInfo: MediaInfo;
  data: MediaSearchResult;
}

type TMDBData =
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
 * 提取JSON对象
 * @param response 响应字符串
 * @returns json对象或null
 */
function extractJsonFromResponse(response: string): MediaInfo | null {
  try {
    logger.debug(`尝试从响应中提取JSON: ${response.substring(0, 200)}...`);
    
    // 使用正则表达式匹配 ```json 和 ``` 之间的内容
    const jsonRegex: RegExp = /```(?:json)?\n?([\s\S]*?)\n?```/;
    const match: RegExpMatchArray | null = response.match(jsonRegex);

    if (!match || !match[1]) {
      // 尝试直接解析整个响应
      try {
        const trimmedResponse = response.trim();
        const jsonObject: MediaInfo = JSON.parse(trimmedResponse);
        logger.debug("成功直接解析整个响应为JSON");
        return jsonObject;
      } catch {
        // 尝试在响应中找到 { 和 } 之间的内容
        const bracesMatch = response.match(/{[\s\S]*?}/);
        if (bracesMatch) {
          let jsonString = bracesMatch[0];
          // 替换单引号为双引号 (处理 {'key': 'value'} 这种格式)
          jsonString = jsonString.replace(/'/g, '"');
          logger.debug(`从大括号中提取JSON并替换单引号: ${jsonString}`);
          const jsonObject: MediaInfo = JSON.parse(jsonString);
          return jsonObject;
        }
        throw new Error("响应中未发现有效的JSON块");
      }
    }

    // 提取 JSON 字符串并清理
    let jsonString: string = match[1].trim();
    
    // 替换单引号为双引号 (处理 LLM 返回单引号 JSON 的情况)
    jsonString = jsonString.replace(/'/g, '"');
    
    // 清理可能导致解析错误的字符
    jsonString = jsonString.replace(/^\s*[\r\n]+/, ''); // 移除开头的空行
    jsonString = jsonString.replace(/[\r\n]+\s*$/, ''); // 移除结尾的空行
    
    logger.debug(`清理后的JSON字符串: ${jsonString}`);
    const jsonObject: MediaInfo = JSON.parse(jsonString);

    return jsonObject;
  } catch (error: unknown) {
    logger.error(
      `提取或解析 JSON 出错: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    
    // 尝试使用更宽松的方法提取信息
    try {
      // 找到所有可能包含标题、季数和集数的信息
      const titleMatch = response.match(/['"]title['"]\s*:\s*['"](.+?)['"]/);
      const seasonMatch = response.match(/['"]season['"]\s*:\s*(\d+)/);
      const episodeMatch = response.match(/['"]episode['"]\s*:\s*(\d+)/);
      
      if (titleMatch) {
        const result: MediaInfo = {
          title: titleMatch[1]
        };
        
        if (seasonMatch) result.season = parseInt(seasonMatch[1]);
        if (episodeMatch) result.episode = parseInt(episodeMatch[1]);
        
        logger.info(`通过正则提取到媒体信息: ${JSON.stringify(result)}`);
        return result;
      }
    } catch (regexError) {
      logger.error(`正则提取也失败: ${regexError}`);
    }
    
    return null;
  }
}

/**
 * 使用LLM提取文件名中的媒体信息
 * @param fileName 文件名
 * @returns 提取的媒体信息
 */
export async function extractMediaInfoWithLLM(
  fileName: string
): Promise<MediaInfo> {
  try {
    logger.info(`使用LLM提取文件名信息: ${fileName}`);

    const response = await ollama.chat({
      model: LLM_MODEL,
      messages: [
        {
          role: "user",
          content: `${prompt}\n\n文件名: "${fileName}"`,
        },
      ],
    });

    logger.debug(`LLM响应: ${response.message.content}`);

    // 解析JSON响应
    const contentStr = response.message.content;

    const jsonData = extractJsonFromResponse(contentStr);
    if (!jsonData) {
      logger.error(`无法解析JSON数据，尝试使用传统方式提取: ${fileName}`);
      // 使用传统方式提取媒体信息
      const fallbackInfo = extractMediaInfo(fileName);
      logger.info(`传统方式提取的媒体信息: ${JSON.stringify(fallbackInfo)}`);
      return fallbackInfo;
    }
    
    logger.info(`LLM提取的媒体信息: ${JSON.stringify(jsonData)}`);

    // 如果季数不存在但是集数存在，默认为第1季
    if (!jsonData.season && jsonData.episode) {
      logger.info(`无法确定"${fileName}"的季节。默认为第1季`);
      jsonData.season = 1;
    }

    // 确保有有效的标题
    if (!jsonData.title || jsonData.title.trim() === '') {
      throw new Error(`无法从文件名 "${fileName}" 提取标题`);
    }

    return jsonData;
  } catch (error: any) {
    logger.error(`LLM提取媒体信息失败: ${error.message}`);
    // 失败时尝试使用传统正则方式提取
    return extractMediaInfo(fileName);
  }
}

/**
 * 使用LLM判断媒体类型并选择最佳匹配项
 * @param mediaInfo 媒体信息
 * @param fileName 文件名
 * @param tvResults 电视剧搜索结果
 * @param movieResults 电影搜索结果
 * @returns 媒体类型和选中的数据
 */
async function determineLLMMediaType(
  mediaInfo: MediaInfo,
  fileName: string,
  tvResults: TvResult[],
  movieResults: MovieResult[]
): Promise<{ 
  mediaType: "tv" | "movie" | null;
  selectedData: TvResult[] | MovieResult[] | null;
  selectedIndex: number;
}> {
  // 处理无结果或单一类型结果的简单情况
  if (tvResults.length === 0 && movieResults.length === 0) {
    return { mediaType: null, selectedData: null, selectedIndex: -1 };
  }
  if (tvResults.length > 0 && movieResults.length === 0) {
    return { mediaType: "tv", selectedData: tvResults, selectedIndex: 0 };
  }
  if (movieResults.length > 0 && tvResults.length === 0) {
    return { mediaType: "movie", selectedData: movieResults, selectedIndex: 0 };
  }

  try {
    // 构建更简洁有效的LLM提示
    const prompt = `分析文件"${fileName}"，判断它是电影还是电视剧，并选择最匹配的项目。
媒体信息: ${JSON.stringify(mediaInfo)}

${tvResults.length > 0 ? `电视剧选项：\n${tvResults.slice(0, 3).map((show, idx) => 
  `TV${idx + 1}: ${show.name} (${show.first_air_date?.substring(0, 4) || "未知"})`).join("\n")}\n` : ""}

${movieResults.length > 0 ? `电影选项：\n${movieResults.slice(0, 3).map((movie, idx) => 
  `MOV${idx + 1}: ${movie.title} (${movie.release_date?.substring(0, 4) || "未知"})`).join("\n")}\n` : ""}

请只回答"类型:编号"，如"tv:1"或"movie:2"，不需要任何解释。`;

    logger.debug(`LLM媒体类型判断请求: ${prompt}`);
    
    // 调用LLM进行判断
    const response = await ollama.chat({
      model: LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      options: { temperature: 0.1 } // 降低随机性提高确定性
    });

    // 提取LLM响应中的媒体类型和选项编号
    const responseText = response.message.content.trim();
    const match = responseText.match(/(tv|movie):(\d+)/i);
    
    if (match) {
      const mediaType = match[1].toLowerCase() as "tv" | "movie";
      const selectedIndex = parseInt(match[2], 10) - 1;
      const validIndex = mediaType === "tv" 
        ? selectedIndex >= 0 && selectedIndex < tvResults.length
        : selectedIndex >= 0 && selectedIndex < movieResults.length;
      
      if (validIndex) {
        const selectedName = mediaType === "tv" 
          ? tvResults[selectedIndex].name 
          : movieResults[selectedIndex].title;
        
        logger.info(`LLM选择: ${mediaType}, 索引: ${selectedIndex}, 标题: ${selectedName}`);
        
        return { 
          mediaType, 
          selectedData: mediaType === "tv" ? tvResults : movieResults, 
          selectedIndex 
        };
      }
    }
    
    // LLM结果解析失败，回退到基于季集信息的简单判断
    logger.error(`LLM响应无法解析: "${responseText}"，回退到简单判断`);
  } catch (error) {
    logger.error(`LLM判断媒体类型失败: ${error}`);
  }
  
  // 回退策略: 基于媒体信息和结果数量进行判断
  // 有季集信息优先认为是电视剧
  if ((mediaInfo.season || mediaInfo.episode) && tvResults.length > 0) {
    return { mediaType: "tv", selectedData: tvResults, selectedIndex: 0 };
  }
  
  // 默认选择结果数量较多的类型
  return tvResults.length >= movieResults.length
    ? { mediaType: "tv", selectedData: tvResults, selectedIndex: 0 }
    : { mediaType: "movie", selectedData: movieResults, selectedIndex: 0 };
}

/**
 * 使用LLM搜索媒体数据
 * @param fileName 文件名
 * @param isDirectory 是否为目录
 * @returns 搜索结果
 */
export async function searchLLMData(
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
      // 提取媒体信息
      mediaInfo = await extractMediaInfoWithLLM(fileName);
      logger.info(`LLM提取的媒体信息：${JSON.stringify(mediaInfo)}`);

      if (!mediaInfo.title) {
        return reject(new Error(`无法提取有效标题: "${fileName}"`));
      }

      parameters.query = mediaInfo.title;

      // 记录季集信息
      if (mediaInfo.season || mediaInfo.episode) {
        const seasonInfo = mediaInfo.season ? `第${mediaInfo.season}季` : "";
        const episodeInfo = mediaInfo.episode ? `第${mediaInfo.episode}集` : "";
        logger.info(`检测到剧集信息: ${seasonInfo} ${episodeInfo}`);
      }
    } catch (error) {
      return reject(new Error(`无法从"${fileName}"提取有效标题: ${error}`));
    }

    try {
      // 搜索TMDB数据
      const [tvResponse, movieResponse, collectionResponse] = await Promise.all([
        moviedb.searchTv(parameters).catch(() => ({ results: [] })),
        moviedb.searchMovie(parameters).catch(() => ({ results: [] })),
        moviedb.searchCollection(parameters).catch(() => ({ results: [] })),
      ]);

      const tvResults = tvResponse.results || [];
      const movieResults = movieResponse.results || [];
      const collectionResults = collectionResponse.results || [];

      logger.info(`搜索结果: 电视剧=${tvResults.length}, 电影=${movieResults.length}, 集合=${collectionResults.length}`);

      // 使用LLM判断媒体类型
      const { mediaType, selectedData, selectedIndex } = await determineLLMMediaType(
        mediaInfo, 
        fileName, 
        tvResults, 
        movieResults
      );

      // 构建基础结果
      const baseResult: BaseMediaSearchResult = {
        title: mediaInfo.title,
        season: mediaInfo.season,
        episode: mediaInfo.episode,
        movieData: movieResponse as MovieResultsResponse,
        tvData: tvResponse as TvResultsResponse,
        collectionData: collectionResponse as SearchCollectionResponse,
      };

      // 处理集合信息
      if (collectionResults.length > 0 && mediaType === "movie") {
        try {
          const id = collectionResults[0].id;
          if (id) {
            logger.info(`处理电影集合: ${collectionResults[0].name}`);
            const collectionInfo = await moviedb.collectionInfo({ 
              id, 
              language: config.language 
            });
            
            const collectionContentID = collectionInfo.parts
              ?.filter(part => part.id && movieResults.some(movie => movie.id === part.id))
              .map(part => part.id as number) || [];
            
            if (collectionContentID.length > 0) {
              baseResult.isCollection = true;
              baseResult.collectionContentID = collectionContentID;
              logger.info(`电影集合包含${collectionContentID.length}部作品`);
            }
          }
        } catch (error) {
          logger.error(`获取集合信息失败：${error}`);
        }
      }

      // 构建最终结果并处理选中项排序
      let result: MediaSearchResult;
      
      if (mediaType === "tv" && selectedData) {
        result = {
          ...baseResult,
          mediaType,
          selectedData: selectedData as TvResult[]
        };
      } else if (mediaType === "movie" && selectedData) {
        result = {
          ...baseResult,
          mediaType,
          selectedData: selectedData as MovieResult[]
        };
      } else {
        result = {
          ...baseResult,
          mediaType: null,
          selectedData: null
        };
      }

      // 如果有明确选择的项目且不是第一个，重排序将其提升到第一位
      if (selectedIndex > 0 && result.selectedData && result.selectedData.length > selectedIndex) {
        const selected = result.selectedData[selectedIndex];
        if (mediaType === "tv") {
          const tvData = result.selectedData as TvResult[];
          result.selectedData = [
            selected as TvResult,
            ...tvData.slice(0, selectedIndex),
            ...tvData.slice(selectedIndex + 1)
          ];
        } else if (mediaType === "movie") {
          const movieData = result.selectedData as MovieResult[];
          result.selectedData = [
            selected as MovieResult,
            ...movieData.slice(0, selectedIndex),
            ...movieData.slice(selectedIndex + 1)
          ];
        }
      }
      
      resolve({ mediaInfo, data: result });
    } catch (error) {
      logger.error(`TMDB 搜索失败：${error}`);
      reject(error);
    }
  });
}

/**
 * 使用LLM检索媒体信息
 * @param fileName 文件名
 * @param isDirectory 是否为目录
 * @param fullPath 完整路径
 * @returns 媒体信息
 */
export function RetrieveLLMInfo(
  fileName: string,
  isDirectory: boolean,
  fullPath?: string
): Promise<TMDBData> {
  return new Promise(async (resolve, reject) => {
    // 处理搜索结果的函数
    const processSearchResult = async (LLMData: SearchTMDBData) => {
      logger.debug(`处理LLM搜索结果: ${JSON.stringify(LLMData.mediaInfo)}`);
      
      // 处理没有结果的情况
      if (!LLMData.data.selectedData || LLMData.data.selectedData.length === 0) {
        return reject(new Error("没有找到匹配的内容"));
      }
      
      // 获取首选项目（已排序）
      const selectedItem = LLMData.data.selectedData[0];
      const id = selectedItem.id;
      
      if (!id) return reject(new Error("无法获取媒体ID"));

      try {
        if (LLMData.data.mediaType === "tv") {
          // 获取电视剧季信息
          const seasonNumber = LLMData.data.season ?? 1;
          logger.info(`获取电视剧[${id}]第${seasonNumber}季信息`);
          
          const tvResponse = await moviedb.seasonInfo({
            id,
            season_number: seasonNumber,
            language: config.language,
          });
          
          const result: TMDBData = {
            title: LLMData.data.title,
            info: LLMData.data,
            season: seasonNumber,
            data: tvResponse,
            type: "tv",
          };

          // 设置集信息
          if (
            !isDirectory &&
            tvResponse.episodes &&
            LLMData.mediaInfo.episode
          ) {
            const episodeIndex = LLMData.mediaInfo.episode - 1;
            if (episodeIndex >= 0 && episodeIndex < tvResponse.episodes.length) {
              result.episodeTitle = tvResponse.episodes[episodeIndex].name;
              result.episode = LLMData.mediaInfo.episode;
              logger.info(`设置集数: ${result.episode}, 标题: ${result.episodeTitle}`);
            }
          }

          resolve(result);
        } else if (LLMData.data.mediaType === "movie") {
          // 获取电影信息
          logger.info(`获取电影[${id}]信息`);
          const movieResponse = await moviedb.movieInfo({ 
            id, 
            language: config.language 
          });
          
          const result: TMDBData = {
            title: LLMData.data.title,
            info: LLMData.data,
            data: movieResponse,
            type: "movie",
          };
          
          resolve(result);
        } else {
          reject(new Error("无法确定媒体类型"));
        }
      } catch (error) {
        logger.error(`获取详细媒体信息失败: ${error}`);
        reject(error);
      }
    };

    // 尝试提取集数信息的函数
    const extractEpisodeInfo = (
      result: TMDBData,
      originalFileName: string
    ): TMDBData => {
      try {
        const episode = extractEpisode(originalFileName);
        if (!episode) {
          throw new Error(`无法从"${originalFileName}"提取集数`);
        }
        
        result.episode = episode;
        
        if (result.type === "tv") {
          if (result.data.episodes && episode - 1 < result.data.episodes.length) {
            result.episodeTitle = result.data.episodes[episode - 1].name;
          } else {
            result.episodeTitle = `第${episode}集`;
          }
          logger.info(`从文件名提取集数: ${episode}, 标题: ${result.episodeTitle}`);
        }
        
        return result;
      } catch (error) {
        logger.error(`提取集数信息失败: ${error}`);
        throw error;
      }
    };

    // 主要逻辑流程
    try {
      // 优先从文件名提取信息
      const data = await searchLLMData(fileName, isDirectory);
      await processSearchResult(data);
    } catch (error) {
      // 文件名提取失败，尝试从父文件夹提取
      if (!isDirectory && fullPath) {
        logger.info(`文件名提取失败，尝试从父文件夹提取`);
        const parentDir = path.basename(path.dirname(fullPath));

        if (parentDir && parentDir !== '.') {
          logger.info(`尝试从父文件夹提取: "${parentDir}"`);
          try {
            const result = await RetrieveLLMInfo(parentDir, true);
            // 保留原始文件的集数信息
            resolve(extractEpisodeInfo(result, fileName));
          } catch (parentError) {
            logger.error(`从父文件夹提取失败: ${parentError}`);
            reject(error); // 返回原始错误
          }
        } else {
          reject(error);
        }
      } else {
        reject(error);
      }
    }
  });
}
