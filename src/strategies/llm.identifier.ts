import { Ollama } from "ollama";
import OpenAI from "openai";
import { MovieDb, MovieResult, TvResult } from "moviedb-promise";
import { getConfig, Config } from "@/config/config";
import { getPrompt, getSpecialFolderPrompt } from "@/config/prompt";
import { IMediaIdentifier, IdentifiedMedia } from "@/types/media.types";
import { logger } from "@/utils/logger";
import { getMediaName, getMediaReleaseDate } from "@/utils/media";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import * as fs from 'fs';
import * as path from 'path';

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
 * @interface LLMFolderIdentification
 * @description LLM 识别特殊文件夹的结果接口（单个文件夹）
 */
export interface LLMFolderIdentification {
  type: 'BDMV' | 'VIDEO_TS' | 'ISO' | 'NORMAL';
  title: string;
  originalName: string;
  subFolderName: string | null; // 子文件夹的完整名称（用于在父文件夹中搜索）
  mediaType: 'movie' | 'tv' | 'collection' | 'unknown'; // LLM 判断的媒体类型
  isMultiDisc: boolean;
  discNumber: number | null;
  contentType: 'main' | 'sp' | 'bonus' | 'menu' | 'pv' | 'ova' | 'other';
  year: number | null;
}

/**
 * @interface FolderStructureInfo
 * @description 文件夹结构信息
 */
export interface FolderStructureInfo {
  folderName: string;
  structure: Record<string, string[] | null>;
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

  constructor(config: Config) {
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

  constructor(config: Config) {
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
  /**
   * 构造函数，执行基本的配置验证。
   */
  constructor() {
    // 获取当前配置进行基础验证
    const config = getConfig();
    
    if (!config.useLlm) {
      throw new Error("LLM识别器不应在 useLlm 为 false 时被初始化");
    }

    if (!config.llmProvider) {
      throw new Error("未配置LLM提供商");
    }
    
    if (config.llmProvider === "ollama" && (!config.llmHost || !config.llmModel)) {
      throw new Error("Ollama配置不完整，需要 llmHost 和 llmModel");
    }
    
    if (config.llmProvider === "openai" && (!config.openaiApiKey || !config.openaiModel)) {
      throw new Error("OpenAI配置不完整，需要 openaiApiKey 和 openaiModel");
    }
  }

  /**
   * 创建LLM客户端实例
   */
  private createLlmClient(config: Config): { client: LlmClient; model: string } {
    switch (config.llmProvider) {
      case "ollama":
        return {
          client: new OllamaClient(config),
          model: config.llmModel!
        };
      case "openai":
        return {
          client: new OpenAiClient(config),
          model: config.openaiModel!
        };
      default:
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

      // 获取最新配置
      const config = getConfig();
      const moviedb = new MovieDb(config.tmdbApi!);

      // 1. 使用LLM从文件名中提取基础信息
      const extractedInfo = await this.extractWithLLM(fileName, config);
      if (!extractedInfo || !extractedInfo.title) {
        logger.warn(`LLM无法从 "${fileName}" 提取有效标题。`);
        return null;
      }

      // 2. 使用提取的标题在TMDB中同时搜索电视剧和电影
      const [tvResponse, movieResponse] = await Promise.all([
        moviedb.searchTv({ query: extractedInfo.title, language: config.language }),
        moviedb.searchMovie({ query: extractedInfo.title, language: config.language }),
      ]);

      const tvResults = tvResponse.results || [];
      const movieResults = movieResponse.results || [];

      if (tvResults.length === 0 && movieResults.length === 0) {
        logger.warn(`在TMDB中未找到 "${extractedInfo.title}" 的任何结果。`);
        return null;
      }

      // 3. 使用LLM从搜索结果中决定最佳匹配项
      const { mediaType, selectedIndex } = await this.determineBestMatch(
        extractedInfo,
        fileName,
        tvResults,
        movieResults,
        config
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

      // 4. 获取匹配项的详细信息并格式化为标准输出
      return this.formatResult(
        mediaType,
        selectedItem,
        extractedInfo,
        moviedb,
        config
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
    extractedInfo: ExtractedInfo,
    moviedb: MovieDb,
    config: Config
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
  private async extractWithLLM(fileName: string, config: Config): Promise<ExtractedInfo | null> {
    const { client, model } = this.createLlmClient(config);
    const response = await client.chat({
      model: model,
      messages: [
        { role: "user", content: `${getPrompt()}\n\n文件名: "${fileName}"` },
      ],
    });

    const content = response.message.content;
    if (!content) {
        logger.error(`LLM响应内容为空: ${fileName}`);
        return null;
    }
    logger.debug(`LLM输出的内容: ${content}`);
    try {
      // 尝试从Markdown代码块中提取JSON。
      const markdownJsonRegex = /```(?:json)?\n?([\s\S]*?)\n?```/;
      const markdownMatch = content.match(markdownJsonRegex);
      if (markdownMatch && markdownMatch[1]) {
        return JSON.parse(markdownMatch[1]);
      }

      // 尝试从单反引号中提取JSON。
      const backtickJsonRegex = /`([\s\S]*)`/;
      const backtickMatch = content.match(backtickJsonRegex);
      if (backtickMatch && backtickMatch[1]) {
        return JSON.parse(backtickMatch[1]);
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
    movieResults: MovieResult[],
    config: Config
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

    const { client, model } = this.createLlmClient(config);
    const response = await client.chat({
      model: model,
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

  /**
   * @method identifyFolder
   * @description 识别特殊文件夹类型（BDMV、VIDEO_TS 等），支持返回多个子文件夹信息
   * @param folderPath - 文件夹路径
   * @param maxDepth - 扫描深度，默认2层
   * @returns {Promise<LLMFolderIdentification[] | null>} - 识别出的文件夹信息数组或null
   * @throws {Error} - 当 LLM 解析失败或返回空结果时抛出错误，让队列重试
   */
  public async identifyFolder(
    folderPath: string,
    maxDepth: number = 2
  ): Promise<LLMFolderIdentification[] | null> {
    logger.info(`使用LLM策略识别特殊文件夹: ${folderPath}`);

    // 获取最新配置
    const config = getConfig();

    // 构建文件夹结构信息
    const structureInfo = this.buildFolderStructure(folderPath, maxDepth);

    // 使用 LLM 识别文件夹类型（如果启用）
    let result: LLMFolderIdentification | LLMFolderIdentification[] | null;
    if (config.useLlm) {
      result = await this.identifyFolderWithLLM(structureInfo, config);
    } else {
      result = this.identifyFolderWithBasicRules(structureInfo);
    }

    // 统一返回数组格式
    if (!result) {
      return null;
    }
    
    return Array.isArray(result) ? result : [result];
  }

  /**
   * @method buildFolderStructure
   * @description 构建文件夹结构信息
   */
  private buildFolderStructure(
    folderPath: string,
    maxDepth: number
  ): FolderStructureInfo {
    const folderName = path.basename(folderPath);
    const structure: Record<string, string[] | null> = {};

    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // 对于目录，根据深度递归列出子项
          const subPath = path.join(folderPath, entry.name);
          try {
            if (maxDepth > 1) {
              // 如果深度大于1，递归构建子目录结构
              const subStructure = this.buildFolderStructure(subPath, maxDepth - 1);
              structure[entry.name] = Object.keys(subStructure.structure);
            } else {
              // 深度为1时，只列出直接子项名称
              const subEntries = fs.readdirSync(subPath, { withFileTypes: true });
              structure[entry.name] = subEntries.map(e => e.name);
            }
          } catch {
            structure[entry.name] = [];
          }
        } else {
          // 对于文件，仅记录文件名
          structure[entry.name] = null;
        }
      }
    } catch (error) {
      logger.warn(`构建文件夹结构失败 ${folderPath}: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      folderName,
      structure
    };
  }

  /**
   * @method identifyFolderWithLLM
   * @description 使用 LLM 识别文件夹类型
   * @returns 单个对象或对象数组
   * @throws {Error} - 当 LLM 返回空内容或解析失败时抛出错误
   */
  private async identifyFolderWithLLM(
    structureInfo: FolderStructureInfo,
    config: Config
  ): Promise<LLMFolderIdentification | LLMFolderIdentification[] | null> {
    const { client, model } = this.createLlmClient(config);
    const prompt = getSpecialFolderPrompt();
    
    const userMessage = `${prompt}\n\n${JSON.stringify(structureInfo, null, 2)}`;
    
    const response = await client.chat({
      model: model,
      messages: [
        { role: 'user', content: userMessage }
      ],
      temperature: 0.1
    });

    const content = response.message.content;
    if (!content) {
      const error = new Error(`LLM 返回空内容: ${structureInfo.folderName}`);
      logger.error(error.message);
      throw error;
    }

    // 解析 LLM 响应
    const identification = this.parseFolderLLMResponse(content);
    if (!identification) {
      const error = new Error(`LLM 响应解析失败: ${structureInfo.folderName}`);
      logger.error(error.message);
      throw error;
    }

    return identification;
  }

  /**
   * @method identifyFolderWithBasicRules
   * @description 基础规则识别（不使用 LLM 时的回退方案）
   */
  private identifyFolderWithBasicRules(
    structureInfo: FolderStructureInfo
  ): LLMFolderIdentification | null {
    const { folderName, structure } = structureInfo;
    
    // 检查 BDMV 结构
    if (structure['BDMV']) {
      const bdmvContents = structure['BDMV'] || [];
      if (bdmvContents.some(item => ['STREAM', 'CLIPINF', 'PLAYLIST'].includes(item))) {
        return {
          type: 'BDMV',
          title: this.extractTitle(folderName),
          originalName: folderName,
          subFolderName: null,
          mediaType: 'unknown',
          contentType: 'main',
          ...this.extractDiscInfo(folderName),
          year: this.extractYear(folderName)
        };
      }
    }

    // 检查 DVD 结构
    if (structure['VIDEO_TS']) {
      const videoTsContents = structure['VIDEO_TS'] || [];
      if (videoTsContents.some(item => 
        item.toUpperCase().endsWith('.VOB') || item.toUpperCase().endsWith('.IFO')
      )) {
        return {
          type: 'VIDEO_TS',
          title: this.extractTitle(folderName),
          originalName: folderName,
          subFolderName: null,
          mediaType: 'unknown',
          contentType: 'main',
          ...this.extractDiscInfo(folderName),
          year: this.extractYear(folderName)
        };
      }
    }

    // 检查 ISO 文件
    const isoFiles = Object.keys(structure).filter(key => 
      key.toLowerCase().endsWith('.iso') && structure[key] === null
    );
    if (isoFiles.length > 0) {
      return {
        type: 'ISO',
        title: this.extractTitle(folderName),
        originalName: folderName,
        subFolderName: null,
        mediaType: 'unknown',
        contentType: 'main',
        ...this.extractDiscInfo(folderName),
        year: this.extractYear(folderName)
      };
    }

    // 普通文件夹
    return {
      type: 'NORMAL',
      title: folderName,
      originalName: folderName,
      subFolderName: null,
      mediaType: 'unknown',
      contentType: 'main',
      isMultiDisc: false,
      discNumber: null,
      year: null
    };
  }

  /**
   * @method parseFolderLLMResponse
   * @description 解析 LLM 响应（特殊文件夹识别），支持单个对象或数组
   * @throws {Error} - 当解析失败或返回空数组时抛出错误
   */
  private parseFolderLLMResponse(content: string): LLMFolderIdentification | LLMFolderIdentification[] | null {
    try {
      // 清理内容
      let cleanedContent = content.trim();
      
      // 处理多层嵌套的代码块标记（递归移除所有 ``` 标记）
      // 例如: ```\n```json\n[...]\n```\n``` 或 ```\n```\njson\n[...]\n```
      let iterations = 0;
      const maxIterations = 10; // 防止无限循环
      
      while (cleanedContent.includes('```') && iterations < maxIterations) {
        iterations++;
        // 提取最内层的代码块
        const markdownJsonRegex = /```(?:json|js|javascript)?\s*\n?([\s\S]*?)\n?```/;
        const markdownMatch = cleanedContent.match(markdownJsonRegex);
        if (markdownMatch && markdownMatch[1]) {
          cleanedContent = markdownMatch[1].trim();
        } else {
          // 如果没有匹配到完整的代码块，尝试移除所有 ``` 标记
          cleanedContent = cleanedContent.replace(/```(?:json|js|javascript)?/g, '').trim();
          break;
        }
      }

      // 移除可能的前后空格和换行
      cleanedContent = cleanedContent.replace(/^\s+|\s+$/g, '');
      
      // 如果清理后为空，抛出错误
      if (!cleanedContent) {
        throw new Error('清理后的内容为空');
      }
      
      // 尝试直接解析
      const parsed = JSON.parse(cleanedContent);
      
      // 验证返回的数据
      if (Array.isArray(parsed)) {
        // 数组：验证每个元素
        if (parsed.length === 0) {
          throw new Error('LLM 返回空数组');
        }
        return parsed as LLMFolderIdentification[];
      } else {
        // 单个对象
        return parsed as LLMFolderIdentification;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`解析 LLM 响应失败: ${errorMessage}\n原始内容: ${content.substring(0, 500)}...`);
      throw new Error(`JSON 解析失败: ${errorMessage}`);
    }
  }

  /**
   * @method extractTitle
   * @description 提取标题（移除标签和元数据）
   */
  private extractTitle(folderName: string): string {
    let title = folderName;
    
    // 移除方括号内容
    title = title.replace(/\[.*?\]/g, '');
    
    // 移除分辨率信息
    title = title.replace(/\b(1080p|720p|2160p|4K|UHD|HD)\b/gi, '');
    
    // 移除编码信息
    title = title.replace(/\b(HEVC|x264|x265|AVC|H\.264|H\.265)\b/gi, '');
    
    // 移除音频信息
    title = title.replace(/\b(FLAC|AAC|DTS|AC3|TrueHD|Atmos)\b/gi, '');
    
    // 移除字幕语言信息
    title = title.replace(/\b(简繁日|CHT|CHS|JPN|ENG)\b/gi, '');
    
    // 移除分卷信息
    title = title.replace(/\b(Disc|Vol\.?|CD|DVD|Part|卷|第.*?卷)\s*\d+\b/gi, '');
    
    // 清理多余空格
    title = title.replace(/\s+/g, ' ').trim();
    
    return title || folderName;
  }

  /**
   * @method extractDiscInfo
   * @description 提取分卷信息
   */
  private extractDiscInfo(folderName: string): { isMultiDisc: boolean; discNumber: number | null } {
    const discPatterns = [
      /Disc\s*(\d+)/i,
      /Vol\.?\s*(\d+)/i,
      /CD\s*(\d+)/i,
      /DVD\s*(\d+)/i,
      /Part\s*(\d+)/i,
      /卷\s*(\d+)/i,
      /第(\d+)卷/i
    ];

    for (const pattern of discPatterns) {
      const match = folderName.match(pattern);
      if (match) {
        return {
          isMultiDisc: true,
          discNumber: parseInt(match[1], 10)
        };
      }
    }

    return {
      isMultiDisc: false,
      discNumber: null
    };
  }

  /**
   * @method extractYear
   * @description 提取年份
   */
  private extractYear(folderName: string): number | null {
    const yearPattern = /\b(19\d{2}|20\d{2})\b/;
    const match = folderName.match(yearPattern);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * @method scrapeMediaInfoForFolder
   * @description 使用 TMDB 为特殊文件夹刮削完整的媒体信息
   * @param folderName - 文件夹名称
   * @param year - 可选的年份信息
   * @param llmMediaType - LLM 判断的媒体类型（优先使用）
   * @returns 包含 TMDB ID、标准化名称和完整媒体信息的对象
   */
  public async scrapeMediaInfoForFolder(
    folderName: string,
    year: number | null = null,
    llmMediaType: 'movie' | 'tv' | 'collection' | 'unknown' = 'unknown'
  ): Promise<{
    tmdbId: number;
    standardizedName: string;
    mediaType: 'movie' | 'tv' | 'collection';
    title: string;
    originalTitle: string | null;
    releaseDate: string | null;
    description: string | null;
    posterPath: string | null;
  } | null> {
    try {
      const config = getConfig();
      const moviedb = new MovieDb(config.tmdbApi!);
      
      // 构建搜索查询
      const searchQuery = year 
        ? `${folderName} ${year}`
        : folderName;
      
      logger.debug(`[TMDB搜索] 查询: ${searchQuery}, LLM判断类型: ${llmMediaType}`);
      
      // 并行搜索电影、电视剧和合集
      const [movieResponse, tvResponse, collectionResponse] = await Promise.all([
        moviedb.searchMovie({ query: searchQuery, language: config.language }),
        moviedb.searchTv({ query: searchQuery, language: config.language }),
        moviedb.searchCollection({ query: searchQuery, language: config.language })
      ]);

      const movieResults = movieResponse.results || [];
      const tvResults = tvResponse.results || [];
      const collectionResults = collectionResponse.results || [];

      if (movieResults.length === 0 && tvResults.length === 0 && collectionResults.length === 0) {
        logger.warn(`[TMDB搜索] 未找到匹配结果: ${folderName}`);
        return null;
      }

      // 根据 LLM 判断的类型选择结果
      let selectedItem;
      let mediaType: 'movie' | 'tv' | 'collection';
      
      // 优先使用 LLM 判断的类型（如果有结果）
      if (llmMediaType === 'movie' && movieResults.length > 0) {
        selectedItem = movieResults[0];
        mediaType = 'movie';
      } else if (llmMediaType === 'tv' && tvResults.length > 0) {
        selectedItem = tvResults[0];
        mediaType = 'tv';
      } else if (llmMediaType === 'collection' && collectionResults.length > 0) {
        selectedItem = collectionResults[0];
        mediaType = 'collection';
      } else {
        // 回退逻辑：优先级 电影 > 电视剧 > 合集
        if (movieResults.length > 0) {
          selectedItem = movieResults[0];
          mediaType = 'movie';
        } else if (tvResults.length > 0) {
          selectedItem = tvResults[0];
          mediaType = 'tv';
        } else {
          selectedItem = collectionResults[0];
          mediaType = 'collection';
        }
      }
      
      logger.debug(`[TMDB搜索] 选择类型: ${mediaType}, 标题: ${getMediaName(selectedItem)}`);

      // 获取详细信息
      const title = getMediaName(selectedItem);
      const releaseDate = getMediaReleaseDate(selectedItem, mediaType);
      const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : year;
      const standardizedName = releaseYear ? `${title} (${releaseYear})` : title || folderName;

      logger.info(`[TMDB搜索] 标准化名称: ${standardizedName}`);

      return {
        tmdbId: selectedItem.id!,
        standardizedName,
        mediaType,
        title: title || folderName,
        originalTitle: (selectedItem as any).original_title || (selectedItem as any).original_name || null,
        releaseDate: releaseDate ? releaseDate.toISOString() : null,
        description: (selectedItem as any).overview || null,
        posterPath: (selectedItem as any).poster_path || null,
      };
    } catch (error) {
      logger.error(`[TMDB搜索] 刮削失败: ${folderName}`, error);
      return null;
    }
  }
}