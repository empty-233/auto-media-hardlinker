import { Type, Prisma, LibraryStatus } from "@/generated/client";
import client from "../client";
import { logger } from "../utils/logger";
import { downloadTMDBImage, formatDate } from "../utils/media";
import { getFileDeviceInfo } from "../utils/hash";
import { Episode } from "moviedb-promise";
import {
  IMediaRepository,
  IdentifiedMedia,
  FileDetails,
} from "../types/media.types";
import { NonRetryableError } from "../core/errors";

export class MediaRepository implements IMediaRepository {
  constructor() {}
  
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

  /**
   * 保存媒体信息和特殊文件夹关联
   * @param media 媒体信息
   * @param folderDetails 文件夹详细信息
   * @param parentFolderId 父文件夹ID（可选，用于子卷）
   * @returns 文件记录
   */
  public async saveMediaAndFolder(
    media: IdentifiedMedia,
    folderDetails: {
      sourcePath: string;
      linkPath: string;
      deviceId: bigint;
      inode: bigint;
      fileHash: string | null;
      fileSize: bigint;
      folderType: string;
      isMultiDisc: boolean;
      discNumber: number | null;
    },
    parentFolderId?: number
  ): Promise<any> {
    try {
      const mediaRecord = await this.findOrCreateMediaRecord(media);
      const episodeId = await this.saveShowOrMovieInfo(mediaRecord.id, media);
      
      // 使用文件夹专用的 upsert 方法
      const fileRecord = await this.upsertFolderRecord(
        mediaRecord.id,
        folderDetails,
        episodeId,
        parentFolderId
      );

      logger.info(`成功将特殊文件夹 "${folderDetails.sourcePath}" 信息保存到数据库`);
      return fileRecord;
    } catch (error) {
      logger.error(`保存特殊文件夹数据库操作失败`, error);
      throw error;
    }
  }

  /**
   * 创建父文件夹记录（用于包含多个子卷的容器文件夹）
   * @param media 媒体信息
   * @param parentFolderPath 父文件夹路径
   * @param linkPath 硬链接路径
   * @returns 父文件夹记录ID
   */
  public async createParentFolderRecord(
    media: IdentifiedMedia,
    parentFolderPath: string,
    linkPath: string
  ): Promise<number> {
    try {
      // 获取父文件夹的设备信息
      const deviceInfo = await getFileDeviceInfo(parentFolderPath);
      
      // 查找或创建媒体记录
      const mediaRecord = await this.findOrCreateMediaRecord(media);
      
      // 检查父文件夹是否已存在
      const existingParent = await client.file.findFirst({
        where: {
          OR: [
            { deviceId: deviceInfo.deviceId, inode: deviceInfo.inode },
            { filePath: parentFolderPath }
          ]
        }
      });

      if (existingParent) {
        logger.info(`父文件夹记录已存在: ${parentFolderPath} (ID: ${existingParent.id})`);
        
        // 更新为父文件夹标识，并更新linkPath
        await client.file.update({
          where: { id: existingParent.id },
          data: {
            isParentFolder: true,
            linkPath,
            Media: { connect: { id: mediaRecord.id } }
          }
        });
        
        return existingParent.id;
      }

      // 创建新的父文件夹记录
      const parentRecord = await client.file.create({
        data: {
          deviceId: deviceInfo.deviceId,
          inode: deviceInfo.inode,
          fileHash: null,
          fileSize: BigInt(0), // 父文件夹不计算实际大小
          filePath: parentFolderPath,
          linkPath, // 父文件夹硬链接路径
          isDirectory: true,
          isParentFolder: true,
          isSpecialFolder: false,
          Media: { connect: { id: mediaRecord.id } }
        }
      });

      logger.info(`创建父文件夹记录: ${parentFolderPath} -> ${linkPath} (ID: ${parentRecord.id})`);
      return parentRecord.id;
    } catch (error) {
      logger.error(`创建父文件夹记录失败: ${parentFolderPath}`, error);
      throw error;
    }
  }

  /**
   * 创建或更新特殊文件夹记录
   */
  private async upsertFolderRecord(
    mediaId: number,
    folderDetails: {
      sourcePath: string;
      linkPath: string;
      deviceId: bigint;
      inode: bigint;
      fileHash: string | null;
      fileSize: bigint;
      folderType: string;
      isMultiDisc: boolean;
      discNumber: number | null;
    },
    episodeId?: number,
    parentFolderId?: number
  ) {
    let existingFile = await client.file.findFirst({
      where: {
        deviceId: folderDetails.deviceId,
        inode: folderDetails.inode,
      },
      include: {
        episodeInfo: true,
      },
    });

    // 如果通过 deviceId 和 inode 没找到，尝试通过 filePath 查找
    if (!existingFile) {
      existingFile = await client.file.findUnique({
        where: {
          filePath: folderDetails.sourcePath,
        },
        include: {
          episodeInfo: true,
        },
      });
    }

    if (existingFile) {
      logger.info(`特殊文件夹记录已存在，将进行更新: ${folderDetails.sourcePath}`);
      const updateData: Prisma.FileUpdateInput = {
        deviceId: folderDetails.deviceId,
        inode: folderDetails.inode,
        fileHash: folderDetails.fileHash,
        fileSize: folderDetails.fileSize,
        filePath: folderDetails.sourcePath,
        linkPath: folderDetails.linkPath,
        isDirectory: true,
        isSpecialFolder: true,
        folderType: folderDetails.folderType,
        isMultiDisc: folderDetails.isMultiDisc,
        discNumber: folderDetails.discNumber,
        Media: { connect: { id: mediaId } },
      };
      
      // 如果有父文件夹ID，关联父文件夹
      if (parentFolderId) {
        updateData.parentFolder = { connect: { id: parentFolderId } };
      }
      
      if (episodeId) {
        updateData.episodeInfo = { connect: { id: episodeId } };
      } else if (existingFile.episodeInfo) {
        updateData.episodeInfo = { disconnect: true };
      }

      // 同时更新Library表中对应的记录状态
      await this.updateLibraryStatus(folderDetails.sourcePath, LibraryStatus.PROCESSED, existingFile.id);

      return client.file.update({
        where: { id: existingFile.id },
        data: updateData,
      });
    } else {
      const fileWithSameLinkPath = await client.file.findFirst({
        where: {
          linkPath: folderDetails.linkPath,
        },
      });

      if (fileWithSameLinkPath) {
        throw new NonRetryableError(
          `目标链接路径 "${folderDetails.linkPath}" 已被另一个文件夹 (ID: ${fileWithSameLinkPath.id}, Path: ${fileWithSameLinkPath.filePath}) 使用。请手动处理冲突。`
        );
      }
      
      logger.info(`创建新的特殊文件夹记录: ${folderDetails.sourcePath}`);

      const fileRecord = await client.file.create({
        data: {
          deviceId: folderDetails.deviceId,
          inode: folderDetails.inode,
          fileHash: folderDetails.fileHash,
          fileSize: folderDetails.fileSize,
          filePath: folderDetails.sourcePath,
          linkPath: folderDetails.linkPath,
          isDirectory: true,
          isSpecialFolder: true,
          folderType: folderDetails.folderType,
          isMultiDisc: folderDetails.isMultiDisc,
          discNumber: folderDetails.discNumber,
          Media: { connect: { id: mediaId } },
          ...(episodeId ? { episodeInfo: { connect: { id: episodeId } } } : {}),
          ...(parentFolderId ? { parentFolder: { connect: { id: parentFolderId } } } : {}),
        },
      });

      // 更新Library表状态并关联fileId
      await this.updateLibraryStatus(folderDetails.sourcePath, LibraryStatus.PROCESSED, fileRecord.id);

      return fileRecord;
    }
  }

  public async findOrCreateMediaRecord(media: IdentifiedMedia) {
    const localPosterUrl = await downloadTMDBImage(media.posterPath, "poster");
    logger.info(`图片本地URL: 海报=${localPosterUrl}`);

    const existingMedia = await client.media.findFirst({
      where: {
        tmdbId: media.tmdbId,
        type: media.type.toLowerCase() as Type,
      },
    });

    if (existingMedia) {
      if (!existingMedia.posterUrl && localPosterUrl) {
        logger.info(`更新了已存在媒体(ID=${existingMedia.id})的海报URL`);
        return client.media.update({
          where: { id: existingMedia.id },
          data: { posterUrl: localPosterUrl },
        });
      }
      return existingMedia;
    }

    return client.media.create({
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
    let existingFile = await client.file.findFirst({
      where: {
        deviceId: fileDetails.deviceId,
        inode: fileDetails.inode,
      },
      include: {
        episodeInfo: true,
      },
    });

    // 如果通过 deviceId 和 inode 没找到，尝试通过 filePath 查找
    if (!existingFile) {
      existingFile = await client.file.findUnique({
        where: {
          filePath: fileDetails.sourcePath,
        },
        include: {
          episodeInfo: true,
        },
      });
    }

    if (existingFile) {
      logger.info(`文件记录已存在，将进行更新: ${fileDetails.sourcePath}`);
      const updateData: Prisma.FileUpdateInput = {
        deviceId: fileDetails.deviceId,
        inode: fileDetails.inode,
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

      return client.file.update({
        where: { id: existingFile.id },
        data: updateData,
      });
    } else {
      const fileWithSameLinkPath = await client.file.findFirst({
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

      const fileRecord = await client.file.create({
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
      const updateData: Prisma.LibraryUpdateManyMutationInput = {
        status,
        lastProcessedAt: new Date(),
        updatedAt: new Date(),
        ...(fileId && { fileId })
      };

      await client.library.updateMany({
        where: { path: filePath },
        data: updateData
      });
    } catch (error) {
      logger.warn(`更新Library表状态失败 ${filePath}: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private async saveMovieInfo(mediaId: number, media: IdentifiedMedia) {
    const existingMovie = await client.movieInfo.findFirst({
      where: { tmdbId: media.tmdbId },
    });

    if (existingMovie) {
      logger.info(`电影信息已存在，无需创建: TMDB ID ${media.tmdbId}`);
      return;
    }

    const movieInfo = await client.movieInfo.create({
      data: {
        tmdbId: media.tmdbId,
        description: media.description,
      },
    });

    await client.media.update({
      where: { id: mediaId },
      data: { movieInfoId: movieInfo.id },
    });
  }

  private async saveTvShowInfo(
    mediaId: number,
    media: IdentifiedMedia
  ): Promise<number | undefined> {
    // 创建或查找 TvInfo
    let tvInfo = await client.tvInfo.findFirst({
      where: { tmdbId: media.tmdbId },
    });

    if (!tvInfo) {
      tvInfo = await client.tvInfo.create({
        data: {
          tmdbId: media.tmdbId,
          description: media.description,
        },
      });
    }

    // 关联 Media 和 TvInfo
    await client.media.update({
      where: { id: mediaId },
      data: { tvInfoId: tvInfo.id },
    });

    // 如果是剧集文件，创建或更新 EpisodeInfo
    if (media.episodeNumber && media.rawData?.episodes) {
      const episodeData = (media.rawData.episodes as Episode[]).find(
        (e) => e.episode_number === media.episodeNumber
      );

      if (episodeData && episodeData.id && episodeData.season_number && episodeData.episode_number) {
        const episodeTmdbId = episodeData.id;
        let episodeInfo = await client.episodeInfo.findFirst({
          where: { tmdbId: episodeTmdbId },
        });

        const localStillUrl = await downloadTMDBImage(
          episodeData.still_path,
          "still"
        );

        if (episodeInfo) {
          // 更新现有剧集的所有信息
          episodeInfo = await client.episodeInfo.update({
            where: { id: episodeInfo.id },
            data: {
              seasonNumber: episodeData.season_number,
              episodeNumber: episodeData.episode_number,
              title: episodeData.name,
              releaseDate: formatDate(episodeData.air_date),
              description: episodeData.overview,
              posterUrl: localStillUrl || episodeInfo.posterUrl, // 如果有新海报就用新的，否则保留旧的
              tvInfoId: tvInfo.id,
            },
          });
          logger.info(`更新剧集信息: ${episodeData.name} (TMDB ID: ${episodeTmdbId})`);
        } else {
          // 创建新剧集
          episodeInfo = await client.episodeInfo.create({
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
          logger.info(`创建剧集信息: ${episodeData.name} (TMDB ID: ${episodeTmdbId})`);
        }
        return episodeInfo.id; // 返回剧集ID
      }
    }
    return undefined; // 如果不是剧集文件，返回undefined
  }
}
