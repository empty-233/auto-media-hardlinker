import { Type, Prisma, LibraryStatus } from "@prisma/client";
import prisma from "../client";
import { logger } from "../utils/logger";
import { downloadTMDBImage, formatDate } from "../utils/media";
import {
  IMediaRepository,
  IdentifiedMedia,
  FileDetails,
} from "../types/media.types";
import { NonRetryableError } from "../core/errors";

export class MediaRepository implements IMediaRepository {
  constructor() {}
  // REFACTOR: 将 saveMediaAndFile 分解为更小的、职责单一的方法
  public async saveMediaAndFile(
    media: IdentifiedMedia,
    fileDetails: FileDetails
  ): Promise<any> {
    try {
      const mediaRecord = await this.findOrCreateMediaRecord(media);
      const episodeId = await this.saveShowOrMovieInfo(mediaRecord.id, media);
      const fileRecord = await this.upsertFileRecord(
        mediaRecord.id,
        fileDetails,
        episodeId
      );

      logger.info(`成功将文件 "${fileDetails.sourcePath}" 信息保存到数据库`);
      return fileRecord;
    } catch (error) {
      logger.error(`数据库操作失败`, error);
      throw error;
    }
  }

  public async findOrCreateMediaRecord(media: IdentifiedMedia) {
    const localPosterUrl = await downloadTMDBImage(media.posterPath, "poster");
    logger.info(`图片本地URL: 海报=${localPosterUrl}`);

    const existingMedia = await prisma.media.findFirst({
      where: {
        tmdbId: media.tmdbId,
        type: media.type.toLowerCase() as Type,
      },
    });

    if (existingMedia) {
      if (!existingMedia.posterUrl && localPosterUrl) {
        logger.info(`更新了已存在媒体(ID=${existingMedia.id})的海报URL`);
        return prisma.media.update({
          where: { id: existingMedia.id },
          data: { posterUrl: localPosterUrl },
        });
      }
      return existingMedia;
    }

    return prisma.media.create({
      data: {
        type: media.type.toLowerCase() as Type,
        tmdbId: media.tmdbId,
        title: media.title,
        originalTitle: media.originalTitle,
        releaseDate: formatDate(media.releaseDate),
        description: media.description,
        posterUrl: localPosterUrl,
      },
    });
  }

  public async saveShowOrMovieInfo(
    mediaId: number,
    media: IdentifiedMedia
  ): Promise<number | undefined> {
    if (media.type === "tv") {
      return this.saveTvShowInfo(mediaId, media);
    } else if (media.type === "movie") {
      await this.saveMovieInfo(mediaId, media);
    }
    return undefined;
  }

  public async upsertFileRecord(
    mediaId: number,
    fileDetails: FileDetails,
    episodeId?: number
  ) {
    const existingFile = await prisma.file.findFirst({
      where: {
        deviceId: fileDetails.deviceId,
        inode: fileDetails.inode,
      },
      include: {
        episodeInfo: true,
      },
    });

    if (existingFile) {
      logger.info(`文件记录已存在，将进行更新: ${fileDetails.sourcePath}`);
      const updateData: Prisma.FileUpdateInput = {
        fileHash: fileDetails.fileHash,
        fileSize: fileDetails.fileSize,
        filePath: fileDetails.sourcePath,
        linkPath: fileDetails.linkPath,
        Media: { connect: { id: mediaId } },
      };
      if (episodeId) {
        updateData.episodeInfo = { connect: { id: episodeId } };
      } else if (existingFile.episodeInfo) {
        updateData.episodeInfo = { disconnect: true };
      }

      // 同时更新Library表中对应的记录状态
      await this.updateLibraryStatus(fileDetails.sourcePath, LibraryStatus.PROCESSED, existingFile.id);

      return prisma.file.update({
        where: { id: existingFile.id },
        data: updateData,
      });
    } else {
      const fileWithSameLinkPath = await prisma.file.findFirst({
        where: {
          linkPath: fileDetails.linkPath,
        },
      });

      if (fileWithSameLinkPath) {
        throw new NonRetryableError(
          `目标链接路径 "${fileDetails.linkPath}" 已被另一个文件 (ID: ${fileWithSameLinkPath.id}, Path: ${fileWithSameLinkPath.filePath}) 使用。请手动处理冲突。`
        );
      }
      
      logger.info(`创建新的文件记录: ${fileDetails.sourcePath}`);

      const fileRecord = await prisma.file.create({
        data: {
          deviceId: fileDetails.deviceId,
          inode: fileDetails.inode,
          fileHash: fileDetails.fileHash,
          fileSize: fileDetails.fileSize,
          filePath: fileDetails.sourcePath,
          linkPath: fileDetails.linkPath,
          Media: { connect: { id: mediaId } },
          ...(episodeId ? { episodeInfo: { connect: { id: episodeId } } } : {}),
        },
      });

      // 更新Library表状态并关联fileId
      await this.updateLibraryStatus(fileDetails.sourcePath, LibraryStatus.PROCESSED, fileRecord.id);

      return fileRecord;
    }
  }

  /**
   * 更新Library表中文件的状态
   */
  private async updateLibraryStatus(filePath: string, status: LibraryStatus, fileId?: number) {
    try {
      const updateData: any = {
        status,
        lastProcessedAt: new Date(),
        updatedAt: new Date()
      };
      
      if (fileId) {
        updateData.fileId = fileId;
      }

      await prisma.library.updateMany({
        where: { path: filePath },
        data: updateData
      });
    } catch (error) {
      logger.warn(`更新Library表状态失败 ${filePath}: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private async saveMovieInfo(mediaId: number, media: IdentifiedMedia) {
    const existingMovie = await prisma.movieInfo.findFirst({
      where: { tmdbId: media.tmdbId },
    });

    if (existingMovie) {
      logger.info(`电影信息已存在，无需创建: TMDB ID ${media.tmdbId}`);
      return;
    }

    const movieInfo = await prisma.movieInfo.create({
      data: {
        tmdbId: media.tmdbId,
        description: media.description,
      },
    });

    await prisma.media.update({
      where: { id: mediaId },
      data: { movieInfoId: movieInfo.id },
    });
  }

  private async saveTvShowInfo(
    mediaId: number,
    media: IdentifiedMedia
  ): Promise<number | undefined> {
    // 1. 创建或查找 TvInfo
    let tvInfo = await prisma.tvInfo.findFirst({
      where: { tmdbId: media.tmdbId },
    });

    if (!tvInfo) {
      tvInfo = await prisma.tvInfo.create({
        data: {
          tmdbId: media.tmdbId,
          description: media.description,
        },
      });
    }

    // 2. 关联 Media 和 TvInfo
    await prisma.media.update({
      where: { id: mediaId },
      data: { tvInfoId: tvInfo.id },
    });

    // 3. 如果是剧集文件，创建或更新 EpisodeInfo
    if (media.episodeNumber && media.rawData?.episodes) {
      const episodeData = media.rawData.episodes.find(
        (e: any) => e.episode_number === media.episodeNumber
      );

      if (episodeData) {
        const episodeTmdbId = episodeData.id;
        let episodeInfo = await prisma.episodeInfo.findFirst({
          where: { tmdbId: episodeTmdbId },
        });

        const localStillUrl = await downloadTMDBImage(
          episodeData.still_path,
          "still"
        );

        if (episodeInfo) {
          // 更新现有剧集
          if (!episodeInfo.posterUrl && localStillUrl) {
            await prisma.episodeInfo.update({
              where: { id: episodeInfo.id },
              data: { posterUrl: localStillUrl },
            });
          }
        } else {
          // 创建新剧集
          episodeInfo = await prisma.episodeInfo.create({
            data: {
              tmdbId: episodeTmdbId,
              seasonNumber: episodeData.season_number,
              episodeNumber: episodeData.episode_number,
              title: episodeData.name,
              releaseDate: formatDate(episodeData.air_date),
              description: episodeData.overview,
              posterUrl: localStillUrl,
              tvInfoId: tvInfo.id,
            },
          });
        }
        return episodeInfo.id; // 返回剧集ID
      }
    }
    return undefined; // 如果不是剧集文件，返回undefined
  }
}
