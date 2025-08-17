import { Request, Response } from "express";
import { FileService, EpisodeService } from "../services";
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

export class FileController {
  constructor(
    private fileService: FileService,
    private episodeService: EpisodeService,
    private mediaHardlinkerService: MediaHardlinkerService,
    private mediaRepository: MediaRepository
  ) {}

  // 获取目录内容
  getDirectoryContents = async (req: Request, res: Response) => {
    try {
      // dirPath 是可选的，不传或传空字符串默认为根目录
      const { dirPath } = req.query as any;
      const result = await this.fileService.getDirectoryContents(dirPath);
      success(res, result, "获取目录内容成功");
    } catch (error) {
      logger.error(`获取目录内容失败`, error);
      internalError(res, "获取目录内容失败");
    }
  }

  // 获取单个文件详情
  getFileById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const fileId = parseInt(id);

      if (isNaN(fileId)) {
        badRequest(res, "文件ID必须是数字");
        return;
      }

      const file = await this.fileService.getFileById(fileId);

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
  renameFile = async (req: Request, res: Response) => {
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
      await this.fileService.updateFilePathAfterRename(oldPath, newPath);

      logger.info(`文件重命名成功: ${oldPath} -> ${newPath}`);
      success(res, { success: true, newPath }, "文件重命名成功");
    } catch (error) {
      logger.error(`文件重命名失败`, error);
      internalError(res, "文件重命名失败");
    }
  }

  // 关联媒体文件到文件记录
  // 支持新文件关联和已有文件的关联更新
  linkMedia = async (req: Request, res: Response) => {
    try {
      // 使用验证中间件验证后的数据，不再需要手动验证
      const { id } = req.params;
      const { mediaInfo, filename, path: filePath, episodeTmdbId, seasonNumber, episodeNumber } = req.body;
      
      const fileId = parseInt(id);
      const seasonNumberInt = seasonNumber !== null ? parseInt(seasonNumber) : null;
      const episodeNumberInt = episodeNumber !== null ? parseInt(episodeNumber) : null;

      // 处理媒体信息
      const processedMedia = await this.processMediaInfo(
        mediaInfo, 
        seasonNumberInt, 
        episodeNumberInt
      );

      // 检查媒体/剧集关联冲突（用于更友好的错误提示）
      await this.checkLinkConflicts(
        processedMedia, 
        fileId, 
        episodeTmdbId, 
        seasonNumberInt, 
        episodeNumberInt
      );

      let result;
      
      if (isNaN(fileId)) {
        // 新文件关联场景 - 使用现有的完整流程
        result = await this.handleNewFileLink(
          { path: filePath, filename }, 
          processedMedia
        );
      } else {
        // 更新已有文件关联场景
        result = await this.handleExistingFileLink(
          fileId,
          { path: filePath, filename },
          processedMedia,
          episodeTmdbId,
          seasonNumberInt,
          episodeNumberInt
        );
      }

      success(res, result, "关联媒体成功");
    } catch (error: any) {
      logger.error(`关联媒体失败`, error);
      
      // 更细致的错误处理
      const errorMessage = error instanceof Error ? error.message : "关联媒体失败";
      if (errorMessage.includes("不存在") || 
          errorMessage.includes("已被") || 
          error.name === "NonRetryableError") {
        badRequest(res, errorMessage);
      } else {
        internalError(res, errorMessage);
      }
    }
  }

  /**
   * 检查关联冲突
   * @param processedMedia 处理后的媒体信息
   * @param fileId 当前文件ID (新文件时为NaN)
   * @param episodeTmdbId 剧集TMDB ID
   * @param seasonNumber 季号
   * @param episodeNumber 集号
   * @throws 如果发现冲突则抛出错误
   */
  private async checkLinkConflicts(
    processedMedia: any,
    fileId: number,
    episodeTmdbId: number,
    seasonNumber: number | null,
    episodeNumber: number | null
  ) {
    // 获取或创建媒体记录来获取 mediaId
    if (!processedMedia.tmdbId) {
      return; // 没有 TMDB ID，无需检查
    }

    const mediaRecord = await this.mediaRepository.findOrCreateMediaRecord(processedMedia);
    
    // 对于电视剧，还需要查找剧集信息来获取 episodeInfoId
    let episodeInfoId: number | undefined;
    if (processedMedia.type === "tv" && seasonNumber !== null && episodeNumber !== null) {
      const episodeInfo = await this.findEpisodeInfo(
        episodeTmdbId, 
        seasonNumber, 
        episodeNumber
      );
      episodeInfoId = episodeInfo.id;
    }

    // 检查媒体和剧集是否已有其他文件关联
    const existingFile = await this.fileService.checkMediaFileLink(
      mediaRecord.id, 
      episodeInfoId
    );
    
    // 如果是新文件关联场景，或者是更新文件但发现媒体已被其他文件关联
    if (existingFile && (isNaN(fileId) || existingFile.id !== fileId)) {
      let errorMessage = `媒体 "${existingFile.Media?.title}" 已被文件关联: ${existingFile.filePath}`;
      
      // 如果是电视剧，添加剧集信息
      if (existingFile.episodeInfo) {
        errorMessage = `剧集 "${existingFile.Media?.title}" S${existingFile.episodeInfo.seasonNumber}E${existingFile.episodeInfo.episodeNumber} 已被文件关联: ${existingFile.filePath}`;
      }
      
      logger.warn(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * 处理媒体信息，包括剧集同步和媒体记录保存
   * @param mediaInfo 原始媒体信息
   * @param seasonNumberInt 季号
   * @param episodeNumberInt 集号
   * @returns 处理后的媒体信息
   */
  private processMediaInfo = async (
    mediaInfo: any, 
    seasonNumberInt: number | null, 
    episodeNumberInt: number | null
  ) => {
    const media = { ...mediaInfo };
    
    // 为电视剧添加季集信息
    if (seasonNumberInt !== null && episodeNumberInt !== null) {
      media.seasonNumber = seasonNumberInt;
      media.episodeNumber = episodeNumberInt;
    }

    // 处理电视剧剧集同步 - 合并了isTvShowWithEpisode的逻辑
    if (media.type === "tv" && seasonNumberInt !== null && episodeNumberInt !== null) {
      logger.info(`检测到电视剧关联，触发 ${media.title} 的剧集同步...`);
      
      const episodeSyncResult = await this.episodeService.syncEpisodesFromTmdb(
        parseInt(media.tmdbId),
        seasonNumberInt
      );
      media.rawData.episodes = episodeSyncResult;
    }

    // 保存媒体记录
    if (media.tmdbId) {
      const mediaRecord = await this.mediaRepository.findOrCreateMediaRecord(media);
      await this.mediaRepository.saveShowOrMovieInfo(mediaRecord.id, media);
    }

    return media;
  }

  /**
   * 处理新文件关联场景
   * @param fileInfo 文件信息
   * @param media 处理后的媒体信息
   * @returns 文件处理结果
   */
  private handleNewFileLink = async (
    fileInfo: { path: string; filename: string }, 
    media: any
  ) => {
    const targetPath = this.mediaHardlinkerService.buildTargetPath(media);
    return await this.mediaHardlinkerService.handleSingleFile(
      fileInfo,
      media,
      targetPath,
      true // 保存到数据库
    );
  }

  /**
   * 处理已有文件的关联更新场景
   * @param fileId 文件ID
   * @param fileInfo 文件信息
   * @param media 处理后的媒体信息
   * @param episodeTmdbId 剧集TMDB ID
   * @param seasonNumberInt 季号
   * @param episodeNumberInt 集号
   * @returns 文件关联结果
   */
  private handleExistingFileLink = async (
    fileId: number,
    fileInfo: { path: string; filename: string },
    media: any,
    episodeTmdbId: number,
    seasonNumberInt: number | null,
    episodeNumberInt: number | null
  ) => {
    // 获取并验证已有文件信息
    const existingFileInfo = await this.fileService.getFileById(fileId);
    if (!existingFileInfo?.linkPath || existingFileInfo.mediaId == null) {
      throw new Error("文件不存在或未关联媒体");
    }

    // 删除旧的硬链接
    await deleteHardlink(existingFileInfo.linkPath);
    logger.info(`删除旧的硬链接: ${existingFileInfo.linkPath}`);

    // 创建新的硬链接
    const targetPath = this.mediaHardlinkerService.buildTargetPath(media);
    const mediaFileLinkInfo = await this.mediaHardlinkerService.handleSingleFile(
      fileInfo,
      media,
      targetPath,
      false // 不直接保存到数据库，手动处理
    );

    // 查找剧集信息
    const episodeInfo = await this.findEpisodeInfo(
      episodeTmdbId, 
      seasonNumberInt, 
      episodeNumberInt
    );

    // 更新文件记录
    if (mediaFileLinkInfo) {
      await this.mediaRepository.upsertFileRecord(
        existingFileInfo.mediaId,
        mediaFileLinkInfo,
        episodeInfo.id
      );
    }

    // 关联文件到媒体
    return await this.fileService.linkMediaToFile(
      fileId,
      existingFileInfo.mediaId,
      episodeInfo.id,
      seasonNumberInt ?? undefined,
      episodeNumberInt ?? undefined
    );
  }

  /**
   * 查找剧集信息
   * @param episodeTmdbId 剧集TMDB ID
   * @param seasonNumber 季号
   * @param episodeNumber 集号
   * @returns 剧集信息
   * @throws 如果是电视剧但缺少季集信息，或者找不到剧集时抛出错误
   */
  private findEpisodeInfo = async (
    episodeTmdbId: number,
    seasonNumber: number | null,
    episodeNumber: number | null
  ) => {
    if (seasonNumber === null || episodeNumber === null) {
      throw new Error("电视剧文件必须提供季和集的信息");
    }

    const episodeInfo = await this.episodeService.findEpisode(
      episodeTmdbId, 
      seasonNumber, 
      episodeNumber
    );

    if (!episodeInfo) {
      logger.warn(`找不到剧集 S${seasonNumber}E${episodeNumber}`);
      throw new Error(`剧集 S${seasonNumber}E${episodeNumber} 不存在`);
    }

    return episodeInfo;
  }

  // 取消关联媒体文件
  unlinkMedia = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const fileId = parseInt(id);

      if (isNaN(fileId)) {
        badRequest(res, "文件ID必须是数字");
        return;
      }

      const result = await this.fileService.unlinkMediaFromFile(fileId);

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
