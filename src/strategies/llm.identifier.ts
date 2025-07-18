import { Ollama } from "ollama";
import fs from "fs";
import path from "path";
import { MovieDb, MovieResult, TvResult } from "moviedb-promise";
import { getConfig } from "../config/config";
import { IMediaIdentifier, IdentifiedMedia } from "../types/media.types";
import { logger } from "../utils/logger";
import { getMediaName, getMediaReleaseDate } from "../utils/media";

// 初始化
const config = getConfig();
const moviedb = new MovieDb(config.tmdbApi);
const ollama = new Ollama({ host: config.llmHost || "http://localhost:11434" });
const LLM_MODEL = config.llmModel || "qwen2.5";
const promptFilePath = path.join(__dirname, "..", "..", "config", "prompt.md");
const PROMPT = fs.readFileSync(promptFilePath, "utf8");

interface ExtractedInfo {
  title: string;
  season?: number;
  episode?: number;
  year?: number;
}

export class LLMIdentifier implements IMediaIdentifier {
  public async identify(
    fileName: string,
    isDirectory: boolean,
    fullPath?: string
  ): Promise<IdentifiedMedia | null> {
    try {
      logger.info(`使用LLM策略识别: ${fileName}`);

      // 1. 使用LLM提取基础信息
      const extractedInfo = await this.extractWithLLM(fileName);
      if (!extractedInfo || !extractedInfo.title) {
        logger.warn(`LLM无法从 "${fileName}" 提取有效标题。`);
        return null; // 无法提取标题，则终止
      }

      // 2. 在TMDB中搜索
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

      // 3. 使用LLM决定媒体类型和最佳匹配
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

      // 4. 获取详细信息并格式化为IdentifiedMedia
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

  private async formatResult(
    mediaType: "tv" | "movie",
    selectedItem: TvResult | MovieResult,
    extractedInfo: ExtractedInfo
  ): Promise<IdentifiedMedia | null> {
      if (!selectedItem.id) return null;

      let rawData;
      let episodeData = null;

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

  private async extractWithLLM(fileName: string): Promise<ExtractedInfo | null> {
    const response = await ollama.chat({
      model: LLM_MODEL,
      messages: [
        { role: "user", content: `${PROMPT}\n\n文件名: "${fileName}"` },
      ],
    });

    const content = response.message.content;
    try {
      const jsonRegex = /```(?:json)?\n?([\s\S]*?)\n?```/;
      const match = content.match(jsonRegex);
      if (match && match[1]) {
        return JSON.parse(match[1]);
      }
      // 尝试直接解析
      return JSON.parse(content);
    } catch (error) {
      logger.error(`从LLM响应中解析JSON失败: ${content}`, error);
      return null;
    }
  }

  private async determineBestMatch(
    mediaInfo: ExtractedInfo,
    fileName: string,
    tvResults: TvResult[],
    movieResults: MovieResult[]
  ): Promise<{ mediaType: "tv" | "movie" | null; selectedIndex: number }> {
    if (tvResults.length > 0 && movieResults.length === 0) {
      return { mediaType: "tv", selectedIndex: 0 };
    }
    if (movieResults.length > 0 && tvResults.length === 0) {
      return { mediaType: "movie", selectedIndex: 0 };
    }

    const prompt = `分析文件"${fileName}"，判断它是电影还是电视剧，并选择最匹配的项目。
媒体信息: ${JSON.stringify(mediaInfo)}
电视剧选项：
${tvResults.slice(0, 3).map((s, i) => `TV${i + 1}: ${s.name} (${s.first_air_date?.substring(0, 4) || 'N/A'})`).join("\n")}
电影选项：
${movieResults.slice(0, 3).map((m, i) => `MOV${i + 1}: ${m.title} (${m.release_date?.substring(0, 4) || 'N/A'})`).join("\n")}
请只回答"类型:编号"，如"tv:1"或"movie:2"，不需要任何解释。`;

    const response = await ollama.chat({
      model: LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      options: { temperature: 0 },
    });

    const match = response.message.content.trim().match(/(tv|movie):(\d+)/i);
    if (match) {
      const mediaType = match[1].toLowerCase() as "tv" | "movie";
      const selectedIndex = parseInt(match[2], 10) - 1;
      const results = mediaType === "tv" ? tvResults : movieResults;
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        return { mediaType, selectedIndex };
      }
    }

    // Fallback
    logger.warn(`LLM无法确定最佳匹配，将使用回退逻辑: ${fileName}`);
    if ((mediaInfo.season || mediaInfo.episode) && tvResults.length > 0) {
      return { mediaType: "tv", selectedIndex: 0 };
    }
    return tvResults.length >= movieResults.length
      ? { mediaType: "tv", selectedIndex: 0 }
      : { mediaType: "movie", selectedIndex: 0 };
  }
}