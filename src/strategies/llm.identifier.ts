import { Ollama } from "ollama";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { MovieDb, MovieResult, TvResult } from "moviedb-promise";
import { getConfig } from "../config/config";
import { IMediaIdentifier, IdentifiedMedia } from "../types/media.types";
import { logger } from "../utils/logger";
import { getMediaName, getMediaReleaseDate } from "../utils/media";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

// --- 初始化 ---
const config = getConfig();
const moviedb = new MovieDb(config.tmdbApi!);
const promptFilePath = path.join(__dirname, "..", "..", "config", "prompt.md");
const PROMPT = fs.readFileSync(promptFilePath, "utf8");

/**
 * @interface ExtractedInfo
 * @description 从文件名中提取的媒体信息结构。
 */
interface ExtractedInfo {
  title: string; // 标题
  season?: number; // 季号
  episode?: number; // 集号
  year?: number; // 年份
}

/**
 * @interface LlmClient
 * @description 定义一个通用的LLM客户端接口，用于统一不同LLM服务提供商的调用方式。
 */
interface LlmClient {
  chat(options: {
    model: string;
    messages: any[];
    temperature?: number;
  }): Promise<{ message: { content: string | null } }>;
}

/**
 * @class OllamaClient
 * @description Ollama服务的客户端实现。
 */
class OllamaClient implements LlmClient {
  private ollama: Ollama;

  constructor() {
    this.ollama = new Ollama({ host: config.llmHost });
  }

  async chat(options: {
    model: string;
    messages: any[];
    temperature?: number;
  }) {
    const response = await this.ollama.chat({
      model: options.model,
      messages: options.messages,
      options: {
        temperature: options.temperature,
      },
    });
    return {
      message: {
        content: response.message.content,
      },
    };
  }
}

/**
 * @class OpenAiClient
 * @description OpenAI服务的客户端实现。
 */
class OpenAiClient implements LlmClient {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
      baseURL: config.openaiBaseUrl,
    });
  }

  async chat(options: {
    model: string;
    messages: ChatCompletionMessageParam[];
    temperature?: number;
  }) {
    const response = await this.openai.chat.completions.create({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature,
    });
    return {
      message: {
        content: response.choices[0].message.content,
      },
    };
  }
}

/**
 * @class LLMIdentifier
 * @description 使用LLM（大型语言模型）进行媒体文件识别的核心实现。
 */
export class LLMIdentifier implements IMediaIdentifier {
  private llmClient: LlmClient;
  private llmModel: string;

  /**
   * 构造函数，根据配置文件初始化LLM客户端。
   */
  constructor() {
    // 如果配置文件中未启用LLM，则不应该使用此类。
    if (!config.useLlm) {
      throw new Error("LLM识别器不应在 useLlm 为 false 时被初始化。");
    }

    // 根据配置的提供商（ollama或openai）创建相应的客户端实例。
    switch (config.llmProvider) {
      case "ollama":
        this.llmClient = new OllamaClient();
        this.llmModel = config.llmModel!;
        break;
      case "openai":
        this.llmClient = new OpenAiClient();
        this.llmModel = config.openaiModel!;
        break;
      default:
        // 如果提供了无效的提供商，则抛出错误。
        throw new Error(`无效的LLM提供商: ${config.llmProvider}`);
    }
  }

  /**
   * @method identify
   * @description 识别媒体文件的主要方法。
   * @param fileName - 要识别的文件名。
   * @returns {Promise<IdentifiedMedia | null>} - 识别出的媒体信息或null。
   */
  public async identify(
    fileName: string
  ): Promise<IdentifiedMedia | null> {
    try {
      logger.info(`使用LLM策略识别: ${fileName}`);

      // 1. 使用LLM从文件名中提取基础信息（标题、季、集等）。
      const extractedInfo = await this.extractWithLLM(fileName);
      if (!extractedInfo || !extractedInfo.title) {
        logger.warn(`LLM无法从 "${fileName}" 提取有效标题。`);
        return null;
      }

      // 2. 使用提取的标题在TMDB中同时搜索电视剧和电影。
      const [tvResponse, movieResponse] = await Promise.all([
        moviedb.searchTv({ query: extractedInfo.title, language: config.language }),
        moviedb.searchMovie({ query: extractedInfo.title, language: config.language }),
      ]);

      const tvResults = tvResponse.results || [];
      const movieResults = movieResponse.results || [];

      // 如果两类结果都为空，则无法继续。
      if (tvResults.length === 0 && movieResults.length === 0) {
        logger.warn(`在TMDB中未找到 "${extractedInfo.title}" 的任何结果。`);
        return null;
      }

      // 3. 使用LLM从搜索结果中决定最佳匹配项。
      const { mediaType, selectedIndex } = await this.determineBestMatch(
        extractedInfo,
        fileName,
        tvResults,
        movieResults
      );

      if (mediaType === null) {
        logger.warn(`LLM无法确定 "${fileName}" 的媒体类型。`);
        return null;
      }

      const selectedItem =
        mediaType === "tv"
          ? tvResults[selectedIndex]
          : movieResults[selectedIndex];
      
      if (!selectedItem || !selectedItem.id) {
          logger.warn(`LLM选择的项目无效或缺少ID: ${fileName}`);
          return null;
      }

      // 4. 获取匹配项的详细信息并格式化为标准输出。
      return this.formatResult(
        mediaType,
        selectedItem,
        extractedInfo
      );

    } catch (error: any) {
      logger.error(`LLM策略识别失败 for "${fileName}"`, error);
      return null;
    }
  }

  /**
   * @method formatResult
   * @description 将TMDB的原始数据格式化为项目内部使用的 IdentifiedMedia 结构。
   */
  private async formatResult(
    mediaType: "tv" | "movie",
    selectedItem: TvResult | MovieResult,
    extractedInfo: ExtractedInfo
  ): Promise<IdentifiedMedia | null> {
      if (!selectedItem.id) return null;

      let rawData;
      let episodeData = null;

      // 根据媒体类型（电视剧/电影）获取不同的详细信息。
      if (mediaType === 'tv') {
          const seasonNumber = extractedInfo.season ?? 1;
          rawData = await moviedb.seasonInfo({id: selectedItem.id, season_number: seasonNumber, language: config.language});
          if (extractedInfo.episode && rawData.episodes) {
              episodeData = rawData.episodes.find((e: any) => e.episode_number === extractedInfo.episode);
          }
      } else {
          rawData = await moviedb.movieInfo({id: selectedItem.id, language: config.language});
      }

      const result: IdentifiedMedia = {
        type: mediaType,
        tmdbId: selectedItem.id,
        title: getMediaName(selectedItem) || extractedInfo.title,
        originalTitle: extractedInfo.title,
        releaseDate: getMediaReleaseDate(selectedItem, mediaType),
        description: selectedItem.overview || null,
        posterPath: selectedItem.poster_path || null,
        backdropPath: selectedItem.backdrop_path || null,
        seasonNumber: mediaType === 'tv' ? (extractedInfo.season ?? 1) : undefined,
        episodeNumber: mediaType === 'tv' ? extractedInfo.episode : undefined,
        episodeTitle: mediaType === 'tv' && episodeData ? episodeData.name : undefined,
        episodeStillPath: mediaType === 'tv' && episodeData ? episodeData.still_path : null,
        rawData: rawData,
      };
      return result;
  }

  /**
   * @method extractWithLLM
   * @description 调用LLM从文件名中提取结构化信息。
   */
  private async extractWithLLM(fileName: string): Promise<ExtractedInfo | null> {
    const response = await this.llmClient.chat({
      model: this.llmModel,
      messages: [
        { role: "user", content: `${PROMPT}\n\n文件名: "${fileName}"` },
      ],
    });

    const content = response.message.content;
    if (!content) {
        logger.error(`LLM响应内容为空: ${fileName}`);
        return null;
    }
    try {
      // 尝试从Markdown代码块中提取JSON。
      const jsonRegex = /```(?:json)?\n?([\s\S]*?)\n?```/;
      const match = content.match(jsonRegex);
      if (match && match[1]) {
        return JSON.parse(match[1]);
      }
      // 如果没有代码块，尝试直接解析整个响应。
      return JSON.parse(content);
    } catch (error) {
      logger.error(`从LLM响应中解析JSON失败: ${content}`, error);
      return null;
    }
  }

  /**
   * @method determineBestMatch
   * @description 调用LLM在TMDB的搜索结果中选择最匹配的一项。
   */
  private async determineBestMatch(
    mediaInfo: ExtractedInfo,
    fileName: string,
    tvResults: TvResult[],
    movieResults: MovieResult[]
  ): Promise<{ mediaType: "tv" | "movie" | null; selectedIndex: number }> {
    // 如果只有一个类别有结果，直接返回该类别的第一项。
    if (tvResults.length > 0 && movieResults.length === 0) {
      return { mediaType: "tv", selectedIndex: 0 };
    }
    if (movieResults.length > 0 && tvResults.length === 0) {
      return { mediaType: "movie", selectedIndex: 0 };
    }

    // 构建发送给LLM的提示，包含候选的电视剧和电影。
    const prompt = `分析文件"${fileName}"，判断它是电影还是电视剧，并选择最匹配的项目。
媒体信息: ${JSON.stringify(mediaInfo)}
电视剧选项：
${tvResults.slice(0, 3).map((s, i) => `TV${i + 1}: ${s.name} (${s.first_air_date?.substring(0, 4) || 'N/A'})`).join("\n")}
电影选项：
${movieResults.slice(0, 3).map((m, i) => `MOV${i + 1}: ${m.title} (${m.release_date?.substring(0, 4) || 'N/A'})`).join("\n")}
请只回答"类型:编号"，如"tv:1"或"movie:2"，不需要任何解释。`;

    const response = await this.llmClient.chat({
      model: this.llmModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0, // 使用低温以获得更确定的结果。
    });

    const content = response.message.content;
    if (!content) {
        logger.warn(`LLM无法确定最佳匹配，将使用回退逻辑: ${fileName}`);
        return this.fallbackBestMatch(mediaInfo, tvResults, movieResults);
    }

    // 解析LLM的响应，格式应为 "tv:1" 或 "movie:2"。
    const match = content.trim().match(/(tv|movie):(\d+)/i);
    if (match) {
      const mediaType = match[1].toLowerCase() as "tv" | "movie";
      const selectedIndex = parseInt(match[2], 10) - 1;
      const results = mediaType === "tv" ? tvResults : movieResults;
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        return { mediaType, selectedIndex };
      }
    }

    // 如果LLM的响应无法解析或无效，则使用回退逻辑。
    logger.warn(`LLM无法确定最佳匹配，将使用回退逻辑: ${fileName}`);
    return this.fallbackBestMatch(mediaInfo, tvResults, movieResults);
  }

  /**
   * @method fallbackBestMatch
   * @description 当LLM无法做出决策时的回退匹配逻辑。
   */
  private fallbackBestMatch(
    mediaInfo: ExtractedInfo,
    tvResults: TvResult[],
    movieResults: MovieResult[]
  ): { mediaType: "tv" | "movie"; selectedIndex: number } {
    // 如果文件名中包含季/集信息，且有电视剧结果，则优先选择电视剧。
    if ((mediaInfo.season || mediaInfo.episode) && tvResults.length > 0) {
      return { mediaType: "tv", selectedIndex: 0 };
    }
    // 否则，选择结果数量更多的那一类。
    return tvResults.length >= movieResults.length
      ? { mediaType: "tv", selectedIndex: 0 }
      : { mediaType: "movie", selectedIndex: 0 };
  }
}