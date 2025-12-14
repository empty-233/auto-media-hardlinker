import { MovieDb, MovieResult, TvResult } from "moviedb-promise";
import { getConfig } from "@/config/config";
import { regexConfig } from "../../config/regexConfig";
import path from "path";
import { IMediaIdentifier, IdentifiedMedia } from "@/types/media.types";
import { logger } from "@/utils/logger";
import { getMediaName, getMediaReleaseDate } from "@/utils/media";

const config = getConfig();
const moviedb = new MovieDb(config.tmdbApi);

interface ExtractedInfo {
  title: string;
  season?: number;
  episode?: number;
  year?: number;
}

export class RegexIdentifier implements IMediaIdentifier {
  public async identify(
    fileName: string,
    isDirectory: boolean,
    fullPath?: string
  ): Promise<IdentifiedMedia | null> {
    try {
      logger.info(`使用正则策略识别: ${fileName}`);

      // 1. 提取基础信息
      const extractedInfo = this.extractMediaInfo(fileName, isDirectory);
      if (!extractedInfo.title) {
        // 尝试从父目录提取
        if (!isDirectory && fullPath) {
          const parentDir = path.basename(path.dirname(fullPath));
          const parentInfo = this.extractMediaInfo(parentDir, true);
          if (parentInfo.title) {
            extractedInfo.title = parentInfo.title;
            extractedInfo.season = parentInfo.season;
            extractedInfo.year = parentInfo.year;
          } else {
            logger.warn(`正则无法从 "${fileName}" 或其父目录提取有效标题。`);
            return null;
          }
        } else {
          logger.warn(`正则无法从 "${fileName}" 提取有效标题。`);
          return null;
        }
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

      // 3. 决定媒体类型和最佳匹配
      const { mediaType, selectedIndex } = this.determineBestMatch(
        extractedInfo,
        fileName,
        tvResults,
        movieResults
      );
      
      const selectedItem = mediaType === "tv" ? tvResults[selectedIndex] : movieResults[selectedIndex];

      if (!selectedItem || !selectedItem.id) {
          logger.warn(`正则策略选择的项目无效或缺少ID: ${fileName}`);
          return null;
      }

      // 4. 获取详细信息并格式化
      return this.formatResult(mediaType, selectedItem, extractedInfo);

    } catch (error: any) {
      logger.error(`正则策略识别失败 for "${fileName}"`, error);
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

  private determineBestMatch(
    mediaInfo: ExtractedInfo,
    fileName: string,
    tvResults: TvResult[],
    movieResults: MovieResult[]
  ): { mediaType: "tv" | "movie"; selectedIndex: number } {
    const hasMovieResults = movieResults.length > 0;
    const hasTvResults = tvResults.length > 0;
    const hasSeasonEpisode = mediaInfo.season !== undefined || mediaInfo.episode !== undefined;
    const isTheatricalVersion = /剧场版|theatrical|OVA|movie/i.test(fileName);

    if (hasSeasonEpisode && hasTvResults) {
      return { mediaType: "tv", selectedIndex: 0 };
    }
    if (isTheatricalVersion && hasMovieResults) {
      return { mediaType: "movie", selectedIndex: 0 };
    }
    if (hasMovieResults && hasTvResults && movieResults[0] && tvResults[0]) {
      // 简单比较，可替换为更复杂的相似度算法
      return (movieResults[0].popularity || 0) > (tvResults[0].popularity || 0)
        ? { mediaType: "movie", selectedIndex: 0 }
        : { mediaType: "tv", selectedIndex: 0 };
    }
    return hasTvResults
      ? { mediaType: "tv", selectedIndex: 0 }
      : { mediaType: "movie", selectedIndex: 0 };
  }

  private extractMediaInfo(filename: string, isDirectory: boolean): ExtractedInfo {
    let cleanedFilename = filename;
    if (!isDirectory) {
      regexConfig.suffixPatterns.forEach((pattern) => {
        cleanedFilename = cleanedFilename.replace(pattern, "");
      });
    }

    const titleRegexList = isDirectory ? regexConfig.FolderTitleRegExps : regexConfig.TitleRegExps;

    for (const titleRegex of titleRegexList) {
      const match = cleanedFilename.match(titleRegex);
      if (match && match.groups && match.groups.title) {
        const result: ExtractedInfo = {
          title: match.groups.title.trim(),
          year: match.groups.year ? parseInt(match.groups.year, 10) : undefined,
          season: match.groups.season ? this.chineseNumberToArabic(match.groups.season) : this.extractSeason(cleanedFilename),
          episode: isDirectory ? undefined : this.extractEpisode(cleanedFilename),
        };
        if (result.season === undefined) {
            result.season = 1; // 默认第一季
        }
        return result;
      }
    }
    return { title: "" }; // 返回空标题表示失败
  }

  private extractSeason(title: string): number | undefined {
    for (const regex of regexConfig.seasonRegexps) {
      const match = title.match(regex);
      if (match && match[1]) {
        return /[一二三四五六七八九十百千]/.test(match[1])
          ? this.chineseNumberToArabic(match[1])
          : parseInt(match[1], 10);
      }
    }
    return undefined;
  }

  private extractEpisode(title: string): number | undefined {
    for (const regex of regexConfig.episodeRegexps) {
      const match = title.match(regex);
      if (match && match[1]) {
        return /[一二三四五六七八九十百千]/.test(match[1])
          ? this.chineseNumberToArabic(match[1])
          : parseInt(match[1], 10);
      }
    }
    return undefined;
  }

  private chineseNumberToArabic(chineseNumber: string): number {
    const map: { [key: string]: number } = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
    if (chineseNumber === "十") return 10;
    if (chineseNumber.startsWith("十")) return 10 + (map[chineseNumber[1]] || 0);
    return map[chineseNumber] || parseInt(chineseNumber, 10);
  }
}