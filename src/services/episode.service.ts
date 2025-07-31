import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";
import { tmdbService } from "./tmdb.service";
import { formatDate, downloadTMDBImage } from "../utils/media";

const prisma = new PrismaClient();

export class EpisodeService {
  /**
   * 从TMDB同步并存储一部电视剧指定季的所有集的信息（使用事务，包含图片下载）
   * @param tmdbId 电视剧的TMDB ID
   * @param seasonNumber 要同步的季号
   * @returns 返回创建或更新的剧集信息列表
   */
  async syncEpisodesFromTmdb(tmdbId: number, seasonNumber: number) {
    logger.info(`开始从TMDB同步剧集, TMDB ID: ${tmdbId}, 季: ${seasonNumber}`);

    // 1. 获取指定季的信息 (在事务外执行，避免网络请求长时间占用数据库连接)
    const seasonInfo = await tmdbService.getSeasonInfo(tmdbId, seasonNumber);
    if (!seasonInfo || !seasonInfo.episodes) {
      logger.warn(`无法获取TMDB ID ${tmdbId} 的第 ${seasonNumber} 季信息。`);
      return [];
    }

    return prisma
      .$transaction(async (tx) => {
        // 2. 在事务中确保 Media 记录及其 tvInfoId 存在
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

        const upsertPromises = [];

        // 3. 遍历该季的每一集，准备好所有的 upsert 操作
        if (seasonInfo.episodes) {
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

            // 下载剧集封面图
            const localStillUrl = await downloadTMDBImage(
              episode.still_path,
              "still"
            );

            const upsertPromise = tx.episodeInfo.upsert({
              where: { tmdbId: episode.id },
              update: {
                title: episode.name,
                description: episode.overview,
                releaseDate: formatDate(episode.air_date),
                posterUrl: localStillUrl,
              },
              create: {
                tmdbId: episode.id,
                seasonNumber: episode.season_number,
                episodeNumber: episode.episode_number,
                title: episode.name,
                description: episode.overview,
                releaseDate: formatDate(episode.air_date),
                posterUrl: localStillUrl,
                tvInfoId: mediaRecord.tvInfoId, // 关联到 Media 记录对应的 TvInfo
              },
            });
            upsertPromises.push(upsertPromise);
          }
        }

        // 4. 在事务中一次性执行所有 upsert 操作
        const syncedEpisodes = await Promise.all(upsertPromises);

        logger.info(
          `TMDB ID ${tmdbId} 第 ${seasonNumber} 季的剧集信息同步完成，共处理 ${syncedEpisodes.length} 集。`
        );
        return seasonInfo.episodes;
      })
      .catch((error) => {
        logger.error(
          `从TMDB同步剧集信息失败 (事务回滚), TMDB ID: ${tmdbId}, 季: ${seasonNumber}`,
          error
        );
        throw error;
      });
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

  // 更新剧集信息
  async updateEpisode(
    id: number,
    data: { title?: string; description?: string; episodeNumber?: number }
  ) {
    try {
      const { title, description, episodeNumber } = data;

      // 验证请求数据
      if (episodeNumber && isNaN(episodeNumber)) {
        throw new Error("剧集编号必须是数字");
      }

      const updatedEpisode = await prisma.episodeInfo.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(episodeNumber !== undefined ? { episodeNumber } : {}),
        },
      });

      logger.info(`更新ID为${id}的剧集信息成功`);
      return updatedEpisode;
    } catch (error) {
      logger.error(`更新剧集${id}信息失败`, error);
      throw error;
    }
  }
}

export const episodeService = new EpisodeService();
