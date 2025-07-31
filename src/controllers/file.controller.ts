import { Request, Response } from "express";
import { fileService, episodeService } from "../services";
import { logger } from "../utils/logger";
import {
  success,
  badRequest,
  notFound,
  internalError,
} from "../utils/response";
import fs from "fs/promises";
import path from "path";
import { MediaHardlinkerService } from "../core/mediaHardlinker";
import { MediaRepository } from "../repository/media.repository";
import { deleteHardlink } from "../utils/hardlink";

const mediaHardlinkerService = new MediaHardlinkerService();
const mediaRepository = new MediaRepository();

export class FileController {
  // 获取目录内容
  static async getDirectoryContents(req: Request, res: Response) {
    try {
      const { dirPath } = req.query;
      const result = await fileService.getDirectoryContents(dirPath as string);
      success(res, result, "获取目录内容成功");
    } catch (error) {
      logger.error(`获取目录内容失败`, error);
      internalError(res, "获取目录内容失败");
    }
  }

  // 获取单个文件详情
  static async getFileById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const fileId = parseInt(id);

      if (isNaN(fileId)) {
        badRequest(res, "文件ID必须是数字");
        return;
      }

      const file = await fileService.getFileById(fileId);

      if (!file) {
        notFound(res, "文件不存在");
        return;
      }

      success(res, file, "获取文件详情成功");
    } catch (error) {
      logger.error(`获取文件详情失败`, error);
      internalError(res, "获取文件详情失败");
    }
  }

  // 重命名文件
  static async renameFile(req: Request, res: Response) {
    try {
      const { filePath, newName } = req.body;

      if (!filePath || !newName) {
        badRequest(res, "文件路径和新文件名不能为空");
        return;
      }

      const oldPath = path.resolve(filePath);
      const dirPath = path.dirname(oldPath);
      const newPath = path.join(dirPath, newName);

      // 检查文件是否存在
      try {
        await fs.access(oldPath);
      } catch {
        notFound(res, "文件不存在");
        return;
      }

      // 检查新文件名是否已存在
      try {
        await fs.access(newPath);
        badRequest(res, "目标文件名已存在");
        return;
      } catch {
        // 文件不存在，可以重命名
      }

      // 执行重命名
      await fs.rename(oldPath, newPath);

      // 如果文件在数据库中，更新数据库记录
      await fileService.updateFilePathAfterRename(oldPath, newPath);

      logger.info(`文件重命名成功: ${oldPath} -> ${newPath}`);
      success(res, { success: true, newPath }, "文件重命名成功");
    } catch (error) {
      logger.error(`文件重命名失败`, error);
      internalError(res, "文件重命名失败");
    }
  }

  // 关联媒体文件
  static async linkMedia(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { mediaInfo, filename, path, episodeTmdbId, seasonNumber, episodeNumber } =
        req.body;
      const fileId = parseInt(id);
      const mediaId = parseInt(mediaInfo.tmdbId);
      const seasonNumberInt = parseInt(seasonNumber);
      const episodeNumberInt = parseInt(episodeNumber);

      const media = mediaInfo;
      if (seasonNumber !== null && episodeNumber !== null) {
        media.seasonNumber = seasonNumberInt;
        media.episodeNumber = episodeNumberInt;
      }

      const requiredFields = [
        "type",
        "tmdbId",
        "title",
        "originalTitle",
        "releaseDate",
        "description",
        "posterPath",
        "backdropPath",
        "rawData",
      ];

      for (const field of requiredFields) {
        if (!(field in mediaInfo)) {
          badRequest(res, `${field}不能为空`);
          return;
        }
      }

      let result;

      // 统一处理剧集同步逻辑
      if (
        mediaInfo.type === "tv" &&
        seasonNumber !== null &&
        episodeNumber !== null
      ) {
        logger.info(`检测到电视剧关联，触发 ${mediaInfo.title} 的剧集同步...`);
        // 不论是首次关联还是更新，都先确保该季的剧集信息存在
        const episodeSyncResult = await episodeService.syncEpisodesFromTmdb(
          mediaId,
          seasonNumberInt
        );
        media.rawData.episodes = episodeSyncResult;
      }

      if (media.tmdbId) {
        const mediaRecord = await mediaRepository.findOrCreateMediaRecord(
          media
        );
        await mediaRepository.saveShowOrMovieInfo(mediaRecord.id, media);
      }

      const linkMediaFile = async (isSaveDatabase?: boolean) => {
        const targetPath = mediaHardlinkerService.buildTargetPath(media);

        return await mediaHardlinkerService.handleSingleFile(
          { path, filename },
          media,
          targetPath,
          isSaveDatabase
        );
      };

      if (isNaN(fileId)) {
        await linkMediaFile();
      } else {
        const fileInfo = await fileService.getFileById(fileId);
        const linkPath = fileInfo?.linkPath;
        const fileMediaId = fileInfo?.mediaId;
        if (!linkPath || fileMediaId == null) {
          notFound(res, "文件不存在或未关联媒体");
          return;
        }
        await deleteHardlink(linkPath);
        logger.info(`删除旧的硬链接: ${linkPath}`);

        const mediaFileLinkInfo = await linkMediaFile(false);
        const episodeInfo = await episodeService.findEpisode(episodeTmdbId, seasonNumberInt, episodeNumberInt);

        if (!episodeInfo) {
          // logger.warn(`同步后依然找不到剧集 S${seasonNumber}E${episodeNumber}`);
          logger.warn(`找不到剧集 S${seasonNumber}E${episodeNumber}`);
          throw new Error(`剧集 S${seasonNumber}E${episodeNumber} 不存在`);
        }

        if (mediaFileLinkInfo)
          await mediaRepository.upsertFileRecord(
            fileMediaId,
            mediaFileLinkInfo,
            episodeInfo.id
          );
        result = await fileService.linkMediaToFile(
          fileId,
          fileMediaId,
          episodeInfo.id,
          seasonNumber !== null ? seasonNumberInt : undefined,
          episodeNumber !== null ? episodeNumberInt : undefined
        );
      }

      success(res, result, "关联媒体成功");
    } catch (error) {
      logger.error(`关联媒体失败`, error);
      internalError(res, "关联媒体失败");
    }
  }

  // 取消关联媒体文件
  static async unlinkMedia(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const fileId = parseInt(id);

      if (isNaN(fileId)) {
        badRequest(res, "文件ID必须是数字");
        return;
      }

      const result = await fileService.unlinkMediaFromFile(fileId);

      if (!result) {
        notFound(res, "文件不存在");
        return;
      }

      success(res, result, "取消关联媒体成功");
    } catch (error) {
      logger.error(`取消关联媒体失败`, error);
      internalError(res, "取消关联媒体失败");
    }
  }
}

export default FileController;
