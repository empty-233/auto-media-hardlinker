import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";
import { getConfig } from "../config/config";
import fs from "fs/promises";
import path from "path";
import { MediaHardlinkerService } from "../core/fileManage/mediaHardlinker";
import { MediaRepository } from "../repository/media.repository";
import { EpisodeService } from "./episode.service";
import { deleteHardlink } from "../utils/hardlink";
import { BusinessError, ErrorType } from "../core/errors";

const prisma = new PrismaClient();

interface FileSystemItem {
  name: string;
  path: string;
  fullPath: string;
  isDirectory: boolean;
  size?: number;
  extension?: string;
  modifiedTime: Date;
  inDatabase: boolean;
  databaseRecord?: any;
  navigationPath?: string;
  // 特殊文件夹标识
  isSpecialFolder?: boolean;
  folderType?: string | null;
  isMultiDisc?: boolean;
  discNumber?: number | null;
}

export class FileService {
  constructor(
    private mediaHardlinkerService: MediaHardlinkerService,
    private mediaRepository: MediaRepository,
    private episodeService: EpisodeService
  ) {}

  // 获取指定目录下的文件和文件夹（不递归）
  async getDirectoryContents(dirPath?: string) {
    try {
      const config = getConfig();
      const monitorPath = path.resolve(config.monitorFilePath);

      // 处理目录路径：如果是根目录或空字符串，则使用监控根目录
      let targetPath: string;
      if (!dirPath || dirPath === "/" || dirPath === "") {
        targetPath = monitorPath;
      } else {
        // 前端传递的是完整路径，需要检查是否在监控目录内
        const resolvedDirPath = path.resolve(dirPath);

        // 安全检查：确保目标路径在监控目录内
        if (!resolvedDirPath.startsWith(monitorPath)) {
          // 如果不在监控目录内，尝试作为相对路径处理
          const cleanPath = dirPath.startsWith("/")
            ? dirPath.slice(1)
            : dirPath;
          targetPath = path.join(monitorPath, cleanPath);
        } else {
          // 如果已经在监控目录内，直接使用
          targetPath = resolvedDirPath;
        }
      }

      // 最终安全检查：确保目标路径在监控目录内
      const normalizedTargetPath = path.normalize(targetPath);
      const normalizedMonitorPath = path.normalize(monitorPath);

      if (!normalizedTargetPath.startsWith(normalizedMonitorPath)) {
        throw new Error("目录路径不在允许的范围内");
      }

      // 获取数据库中的所有文件
      const dbFiles = await prisma.file.findMany({
        include: {
          Media: true,
          episodeInfo: true,
        },
      });

      // 创建数据库文件路径映射
      const dbFileMap = new Map<string, any>();
      dbFiles.forEach((file) => {
        const originalPath = file.filePath;
        const normalizedPath = path.normalize(originalPath);
        const resolvedPath = path.resolve(originalPath);

        dbFileMap.set(originalPath, file);
        dbFileMap.set(normalizedPath, file);
        dbFileMap.set(resolvedPath, file);
      });

      // 读取当前目录内容
      const items = await this.readSingleDirectory(
        targetPath,
        monitorPath,
        dbFileMap
      );

      // 排序：目录在前，文件在后
      items.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      // 计算相对路径用于面包屑导航
      const relativePath = path.relative(monitorPath, targetPath);
      // 统一使用正斜杠，确保跨平台兼容性
      const normalizedRelativePath = relativePath.replace(/\\/g, '/');
      
      // 计算父路径
      let parentPath: string | null = null;
      if (normalizedRelativePath) {
        const dirname = path.dirname(relativePath).replace(/\\/g, '/');
        // 如果 dirname 是 "."，表示父目录是根目录
        parentPath = (dirname === "." || dirname === "") ? "" : dirname;
      } else {
        // 如果 relativePath 为空，表示当前在根目录，没有父目录
        parentPath = null;
      }

      logger.info(
        `获取目录内容成功，路径: ${targetPath}, 共${items.length}个项目`
      );
      return {
        items,
        currentPath: normalizedRelativePath || "",
        parentPath: parentPath,
      };
    } catch (error) {
      logger.error(`获取目录内容失败`, error);
      throw error;
    }
  }

  // 读取单个目录的内容（不递归）
  private async readSingleDirectory(
    dirPath: string,
    monitorPath: string,
    dbFileMap: Map<string, any>
  ): Promise<FileSystemItem[]> {
    const items: FileSystemItem[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const _config = getConfig();

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const displayPath = path.relative(process.cwd(), fullPath);

        if (entry.isDirectory()) {
          const navigationPath = path.relative(monitorPath, fullPath).replace(/\\/g, '/');
          // 添加目录项
          const stat = await fs.stat(fullPath);

          // 查找数据库中的目录记录
          const normalizedPath = path.normalize(fullPath);
          const resolvedPath = path.resolve(fullPath);

          let dbRecord =
            dbFileMap.get(fullPath) ||
            dbFileMap.get(normalizedPath) ||
            dbFileMap.get(resolvedPath);

          items.push({
            name: entry.name,
            path: displayPath,
            navigationPath: navigationPath,
            fullPath: fullPath,
            isDirectory: true,
            modifiedTime: stat.mtime,
            inDatabase: !!dbRecord,
            databaseRecord: dbRecord,
            // 添加特殊文件夹标识
            isSpecialFolder: dbRecord?.isSpecialFolder,
            folderType: dbRecord?.folderType,
            isMultiDisc: dbRecord?.isMultiDisc,
            discNumber: dbRecord?.discNumber,
          });
        } else {
          // 添加文件项
          const stat = await fs.stat(fullPath);
          const extension = path.extname(entry.name).toLowerCase();

          // 查找数据库记录
          const normalizedPath = path.normalize(fullPath);
          const resolvedPath = path.resolve(fullPath);

          let dbRecord =
            dbFileMap.get(fullPath) ||
            dbFileMap.get(normalizedPath) ||
            dbFileMap.get(resolvedPath);

          items.push({
            name: entry.name,
            path: displayPath,
            fullPath: fullPath,
            isDirectory: false,
            size: stat.size,
            extension: extension,
            modifiedTime: stat.mtime,
            inDatabase: !!dbRecord,
            databaseRecord: dbRecord,
          });
        }
      }
    } catch (error) {
      logger.error(`读取目录 ${dirPath} 失败`, error);
    }

    return items;
  }

  // 获取单个文件详情
  async getFileById(id: number) {
    try {
      const file = await prisma.file.findUnique({
        where: { id },
        include: {
          Media: true,
          episodeInfo: true,
        },
      });

      if (!file) {
        logger.warn(`查询ID为${id}的文件不存在`);
        return null;
      }

      logger.info(`获取ID为${id}的文件详情成功`);
      return file;
    } catch (error) {
      logger.error(`获取文件${id}详情失败`, error);
      throw error;
    }
  }

  // 重命名后更新文件路径
  async updateFilePathAfterRename(oldPath: string, newPath: string) {
    try {
      const file = await prisma.file.findFirst({
        where: { filePath: oldPath },
      });

      if (file) {
        await prisma.file.update({
          where: { id: file.id },
          data: { filePath: newPath },
        });
        logger.info(`更新数据库文件路径: ${oldPath} -> ${newPath}`);
      }
    } catch (error) {
      logger.error(`更新文件路径失败`, error);
      throw error;
    }
  }

  // 关联媒体到文件
  async linkMediaToFile(
    fileId: number,
    mediaId: number,
    episodeInfoId?: number,
    seasonNumber?: number,
    episodeNumber?: number
  ) {
    try {
      // 更新文件的媒体关联
      const file = await prisma.file.update({
        where: { id: fileId },
        data: { mediaId },
        include: {
          Media: true,
          episodeInfo: true,
        },
      });

      if (seasonNumber !== undefined && episodeNumber !== undefined && episodeInfoId) {
        // 关联文件到剧集
        await prisma.file.update({
          where: { id: fileId },
          data: { episodeInfoId },
        });
      }

      logger.info(`文件${fileId}关联媒体${mediaId}成功`);
      return file;
    } catch (error) {
      logger.error(`关联媒体失败`, error);
      throw error;
    }
  }

  // 检查指定的媒体和剧集是否已有其他文件关联
  async checkMediaFileLink(mediaId: number, episodeInfoId?: number) {
    try {
      const whereCondition: any = {
        mediaId: mediaId,
      };

      // 如果提供了剧集ID，则也要匹配剧集ID
      if (episodeInfoId !== undefined) {
        whereCondition.episodeInfoId = episodeInfoId;
      }

      const existingFile = await prisma.file.findFirst({
        where: whereCondition,
        select: {
          id: true,
          filePath: true,
          linkPath: true,
          createdAt: true,
          Media: {
            select: {
              title: true,
              type: true,
            },
          },
          episodeInfo: {
            select: {
              seasonNumber: true,
              episodeNumber: true,
              title: true,
            },
          },
        },
      });

      return existingFile;
    } catch (error) {
      logger.error(
        `检查媒体文件关联失败 (MediaID: ${mediaId}, EpisodeInfoID: ${episodeInfoId})`,
        error
      );
      throw error;
    }
  }

  // 重命名文件
  async renameFile(filePath: string, newName: string) {
    try {
      const oldPath = path.resolve(filePath);
      const dirPath = path.dirname(oldPath);
      const newPath = path.join(dirPath, newName);

      // 检查文件是否存在
      try {
        await fs.access(oldPath);
      } catch {
        throw new BusinessError(ErrorType.FILE_NOT_FOUND, "文件不存在");
      }

      // 检查新文件名是否已存在
      try {
        await fs.access(newPath);
        throw new BusinessError(ErrorType.FILE_EXISTS, "目标文件名已存在");
      } catch (error: any) {
        // 如果是因为文件不存在才抛出的错误，说明可以重命名
        if (error.code !== "ENOENT" && error instanceof BusinessError) {
          throw error;
        }
      }

      // 执行重命名
      await fs.rename(oldPath, newPath);

      // 如果文件在数据库中，更新数据库记录
      await this.updateFilePathAfterRename(oldPath, newPath);

      logger.info(`文件重命名成功: ${oldPath} -> ${newPath}`);
      return { success: true, newPath };
    } catch (error) {
      logger.error(`文件重命名失败`, error);
      throw error;
    }
  }

  // 关联媒体文件的主要业务逻辑
  async linkMediaToFileProcess(
    fileId: number,
    mediaInfo: any,
    filename: string,
    filePath: string,
    episodeTmdbId: number,
    seasonNumber: number | null,
    episodeNumber: number | null
  ) {
    try {
      // 预处理媒体信息（如同步剧集）
      const processedMedia = await this.processMediaInfo(
        mediaInfo,
        seasonNumber,
        episodeNumber
      );

      // 获取或创建媒体主记录
      const mediaRecord = await this.mediaRepository.findOrCreateMediaRecord(
        processedMedia
      );

      // 检查关联冲突
      await this.checkLinkConflicts(
        mediaRecord,
        fileId,
        episodeTmdbId,
        seasonNumber,
        episodeNumber
      );

      // 保存详细的电影或电视剧信息
      await this.mediaRepository.saveShowOrMovieInfo(
        mediaRecord.id,
        processedMedia
      );

      // 执行文件链接操作
      let result;
      const fileInfo = { path: filePath, filename };

      if (isNaN(fileId)) {
        // 新文件关联场景
        result = await this.handleNewFileLink(fileInfo, processedMedia);
      } else {
        // 更新已有文件关联场景
        result = await this.handleExistingFileLink(
          fileId,
          fileInfo,
          processedMedia,
          mediaRecord, // 传递已创建的媒体记录
          episodeTmdbId,
          seasonNumber,
          episodeNumber
        );
      }

      return result;
    } catch (error: any) {
      logger.error(`关联媒体失败`, error);
      throw error;
    }
  }

  /**
   * 检查关联冲突
   * @param mediaRecord 数据库中的媒体记录
   * @param fileId 当前文件ID (新文件时为NaN)
   * @param episodeTmdbId 剧集TMDB ID
   * @param seasonNumber 季号
   * @param episodeNumber 集号
   * @throws 如果发现冲突则抛出错误
   */
  private async checkLinkConflicts(
    mediaRecord: any,
    fileId: number,
    episodeTmdbId: number,
    seasonNumber: number | null,
    episodeNumber: number | null
  ) {
    if (!mediaRecord) {
      return;
    }

    // 对于电视剧，还需要查找剧集信息来获取 episodeInfoId
    let episodeInfoId: number | undefined;
    if (
      mediaRecord.type === "tv" &&
      seasonNumber !== null &&
      episodeNumber !== null
    ) {
      const episodeInfo = await this.findEpisodeInfo(
        episodeTmdbId,
        seasonNumber,
        episodeNumber
      );
      episodeInfoId = episodeInfo?.id;
    }

    // 检查媒体和剧集是否已有其他文件关联
    const existingFile = await this.checkMediaFileLink(
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
      throw new BusinessError(ErrorType.MEDIA_LINK_CONFLICT, errorMessage);
    }
  }

  /**
   * 处理媒体信息，包括剧集同步和媒体记录保存
   * @param mediaInfo 原始媒体信息
   * @param seasonNumberInt 季号
   * @param episodeNumberInt 集号
   * @returns 处理后的媒体信息
   */
  private async processMediaInfo(
    mediaInfo: any,
    seasonNumberInt: number | null,
    episodeNumberInt: number | null
  ) {
    const media = { ...mediaInfo };

    // 为电视剧添加季集信息
    if (seasonNumberInt !== null && episodeNumberInt !== null) {
      media.seasonNumber = seasonNumberInt;
      media.episodeNumber = episodeNumberInt;
    }

    // 处理电视剧剧集同步 - 合并了isTvShowWithEpisode的逻辑
    if (
      media.type === "tv" &&
      seasonNumberInt !== null &&
      episodeNumberInt !== null
    ) {
      logger.info(`检测到电视剧关联，触发 ${media.title} 的剧集同步...`);

      const episodeSyncResult = await this.episodeService.syncEpisodesFromTmdb(
        parseInt(media.tmdbId),
        seasonNumberInt
      );
      media.rawData.episodes = episodeSyncResult;
    }

    return media;
  }

  /**
   * 处理新文件关联场景
   * @param fileInfo 文件信息
   * @param media 处理后的媒体信息
   * @returns 文件处理结果
   */
  private async handleNewFileLink(
    fileInfo: { path: string; filename: string },
    media: any
  ) {
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
   * @param mediaRecord 数据库中的媒体记录
   * @param episodeTmdbId 剧集TMDB ID
   * @param seasonNumberInt 季号
   * @param episodeNumberInt 集号
   * @returns 文件关联结果
   */
  private async handleExistingFileLink(
    fileId: number,
    fileInfo: { path: string; filename: string },
    media: any,
    mediaRecord: any,
    episodeTmdbId: number,
    seasonNumberInt: number | null,
    episodeNumberInt: number | null
  ) {
    // 获取并验证已有文件信息
    const existingFileInfo = await this.getFileById(fileId);
    if (!existingFileInfo?.linkPath || existingFileInfo.mediaId == null) {
      throw new BusinessError(
        ErrorType.VALIDATION_ERROR,
        "文件不存在或未关联媒体"
      );
    }

    // 删除旧的硬链接
    await deleteHardlink(existingFileInfo.linkPath);
    logger.info(`删除旧的硬链接: ${existingFileInfo.linkPath}`);

    // 创建新的硬链接
    const targetPath = this.mediaHardlinkerService.buildTargetPath(media);
    const mediaFileLinkInfo =
      await this.mediaHardlinkerService.handleSingleFile(
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
        mediaRecord.id,
        mediaFileLinkInfo,
        episodeInfo?.id
      );
    }

    // 关联文件到媒体
    return await this.linkMediaToFile(
      fileId,
      mediaRecord.id,
      episodeInfo?.id,
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
  private async findEpisodeInfo(
    episodeTmdbId: number,
    seasonNumber: number | null,
    episodeNumber: number | null
  ) {
    if (
      episodeTmdbId > 0 &&
      (seasonNumber === null || episodeNumber === null)
    ) {
      throw new BusinessError(
        ErrorType.VALIDATION_ERROR,
        "电视剧文件必须提供季和集的信息"
      );
    }

    // 如果是电影，tmdbId会是0，直接返回null
    if (episodeTmdbId === 0 || seasonNumber === 0 || episodeNumber === 0) {
      return null;
    }

    const episodeInfo = await this.episodeService.findEpisode(
      episodeTmdbId,
      seasonNumber!,
      episodeNumber!
    );

    if (!episodeInfo) {
      logger.warn(`找不到剧集 S${seasonNumber}E${episodeNumber}`);
      throw new BusinessError(
        ErrorType.VALIDATION_ERROR,
        `剧集 S${seasonNumber}E${episodeNumber} 不存在`
      );
    }

    return episodeInfo;
  }

  // 取消关联媒体文件业务逻辑
  async unlinkMediaFromFileProcess(fileId: number) {
    try {
      const result = await this.unlinkMediaFromFile(fileId);

      // 如果 service 返回 null 或 false，说明文件不存在或操作失败
      if (!result) {
        throw new BusinessError(
          ErrorType.VALIDATION_ERROR,
          "文件不存在或无法取消关联"
        );
      }

      return result;
    } catch (error) {
      logger.error(`取消关联媒体文件失败`, error);
      throw error;
    }
  }

  // 取消文件的媒体关联
  async unlinkMediaFromFile(fileId: number) {
    try {
      // 取消文件的媒体关联和剧集关联
      const file = await prisma.file.update({
        where: { id: fileId },
        data: {
          mediaId: null,
          episodeInfoId: null,
        },
        include: {
          Media: true,
          episodeInfo: true,
        },
      });

      logger.info(`文件${fileId}取消媒体关联成功`);
      return file;
    } catch (error) {
      logger.error(`取消媒体关联失败`, error);
      throw error;
    }
  }
}
