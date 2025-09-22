import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";
import { TMDBService } from "./tmdb.service";
import { formatDate, downloadTMDBImage } from "../utils/media";

const prisma = new PrismaClient();

export class EpisodeService {
  constructor(private tmdbService: TMDBService) {}
  /**
   * 从TMDB同步并存储一部电视剧指定季的所有集的信息
   * @param tmdbId 电视剧的TMDB ID
   * @param seasonNumber 要同步的季号
   * @returns 返回创建或更新的剧集信息列表
   */
  async syncEpisodesFromTmdb(tmdbId: number, seasonNumber: number) {
    logger.info(`开始从TMDB同步剧集, TMDB ID: ${tmdbId}, 季: ${seasonNumber}`);

    try {
      // 1. 获取指定季的信息
      const seasonInfo = await this.tmdbService.getSeasonInfo(tmdbId, seasonNumber);
      if (!seasonInfo || !seasonInfo.episodes) {
        logger.warn(`无法获取TMDB ID ${tmdbId} 的第 ${seasonNumber} 季信息。`);
        return [];
      }

      // 2. 预处理所有剧集数据，包括下载图片
      const processedEpisodes: Array<{
        tmdbId: number;
        seasonNumber: number;
        episodeNumber: number;
        title: string | null;
        description: string | null;
        releaseDate: Date | string | null;
        posterUrl: string | null;
      }> = [];
      for (const episode of seasonInfo.episodes) {
        if (
          !episode.id ||
          !episode.episode_number ||
          episode.season_number === undefined ||
          episode.season_number === null
        ) {
          logger.warn(`跳过无效的剧集数据: ${JSON.stringify(episode)}`);
          continue;
        }

        // 在事务外下载剧集封面图
        const localStillUrl = await downloadTMDBImage(
          episode.still_path,
          "still"
        );

        processedEpisodes.push({
          tmdbId: episode.id,
          seasonNumber: episode.season_number,
          episodeNumber: episode.episode_number,
          title: episode.name || null,
          description: episode.overview || null,
          releaseDate: formatDate(episode.air_date),
          posterUrl: localStillUrl,
        });
      }

      // 3. 在事务中执行数据库操作
      const syncedEpisodes = await prisma.$transaction(async (tx) => {
        // 确保 Media 记录及其 tvInfoId 存在
        const mediaRecord = await tx.media.findFirst({
          where: { tmdbId: tmdbId, type: "tv" },
        });

        if (!mediaRecord) {
          throw new Error(`媒体记录不存在: TMDB ID ${tmdbId}`);
        }
        if (!mediaRecord.tvInfoId) {
          throw new Error(
            `媒体记录 (ID: ${mediaRecord.id}) 未关联到任何 TvInfo。请先确保媒体信息完整。`
          );
        }

        // 批量执行 upsert 操作
        const upsertPromises = processedEpisodes.map(episodeData => 
          tx.episodeInfo.upsert({
            where: { tmdbId: episodeData.tmdbId },
            update: {
              title: episodeData.title,
              description: episodeData.description,
              releaseDate: episodeData.releaseDate,
              posterUrl: episodeData.posterUrl,
            },
            create: {
              ...episodeData,
              tvInfoId: mediaRecord.tvInfoId, // 关联到 Media 记录对应的 TvInfo
            },
          })
        );

        return await Promise.all(upsertPromises);
      });

      logger.info(
        `TMDB ID ${tmdbId} 第 ${seasonNumber} 季的剧集信息同步完成，共处理 ${syncedEpisodes.length} 集。`
      );
      return seasonInfo.episodes;

    } catch (error) {
      logger.error(
        `从TMDB同步剧集信息失败, TMDB ID: ${tmdbId}, 季: ${seasonNumber}`,
        error
      );
      throw error;
    }
  }
  
  /**
   * 根据 TMDB ID、季号和集号检索剧集信息
   *
   * @param tmdbId 电视剧的 TMDB 标识
   * @param seasonNumber 系列中的季号
   * @param episodeNumber 指定季中的集号
   * @returns 匹配的剧集信息，若未找到则返回 null
   * @throws 如果数据库查询失败，则抛出错误
   */
  async findEpisode(
    tmdbId: number,
    seasonNumber: number,
    episodeNumber: number
  ) {
    try {
      // 使用 tmdbId、季号和集号来查找准确的剧集
      const episodeInfo = await prisma.episodeInfo.findFirst({
        where: {
          tmdbId: tmdbId,
          seasonNumber: seasonNumber,
          episodeNumber: episodeNumber,
        },
      });

      return episodeInfo;
    } catch (error) {
      logger.error(
        `通过电视剧信息查找剧集失败 (TMDB ID: ${tmdbId}, S${seasonNumber}E${episodeNumber})`,
        error
      );
      throw error;
    }
  }
}

