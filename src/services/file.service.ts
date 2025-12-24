import type { Prisma } from "@/generated/client";
import client from "@/client";
import { logger } from "@/utils/logger";
import { getConfig } from "@/config/config";
import fs from "fs/promises";
import path from "path";
import { MediaHardlinkerService } from "@/core/fileManage/mediaHardlinker";
import { MediaRepository } from "@/repository/media.repository";
import { EpisodeService } from "./episode.service";
import { deleteHardlink, createHardlinkRecursively } from "@/utils/hardlink";
import { BusinessError, ErrorType } from "@/core/errors";
import { IdentifiedMedia } from "@/types/media.types";
import { createNfoFromMedia } from "@/utils/nfo/jellyfin";

const prisma = client;

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
  // 父文件夹标识
  isParentFolder?: boolean;
  parentFolderId?: number | null;
  childFolders?: any[];
}

type ParentInfoWithChildren = Prisma.FileGetPayload<{
  include: {
    childFolders: true
  }
}>;

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
          childFolders: {
            include: {
              Media: true,
            },
          },
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
      const normalizedRelativePath = relativePath.replace(/\\/g, "/");

      // 计算父路径
      let parentPath: string | null = null;
      if (normalizedRelativePath) {
        const dirname = path.dirname(relativePath).replace(/\\/g, "/");
        // 如果 dirname 是 "."，表示父目录是根目录
        parentPath = dirname === "." || dirname === "" ? "" : dirname;
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
          const navigationPath = path
            .relative(monitorPath, fullPath)
            .replace(/\\/g, "/");
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
            // 添加父文件夹标识
            isParentFolder: dbRecord?.isParentFolder,
            parentFolderId: dbRecord?.parentFolderId,
            childFolders: dbRecord?.childFolders,
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
      // 获取当前文件信息，检查是否有父文件夹或同级文件夹
      const currentFile = await prisma.file.findUnique({
        where: { id: fileId },
        include: {
          parentFolder: true,
          childFolders: true,
        },
      });

      if (!currentFile) {
        throw new BusinessError(ErrorType.FILE_NOT_FOUND, "文件不存在");
      }

      // 更新文件的媒体关联
      const file = await prisma.file.update({
        where: { id: fileId },
        data: {
          mediaId,
          ...(episodeInfoId &&
          seasonNumber !== undefined &&
          episodeNumber !== undefined
            ? { episodeInfoId }
            : {}),
        },
        include: {
          Media: true,
          episodeInfo: true,
        },
      });

      logger.info(`文件${fileId}关联媒体${mediaId}成功`);

      // 如果是子文件夹，同步更新父文件夹和所有同级子文件夹
      if (currentFile.parentFolderId) {
        logger.info(`检测到子文件夹，开始同步父文件夹和同级子文件夹...`);

        // 更新父文件夹
        await prisma.file.update({
          where: { id: currentFile.parentFolderId },
          data: {
            mediaId,
            ...(episodeInfoId ? { episodeInfoId } : {}),
          },
        });
        logger.info(`已同步父文件夹 (ID: ${currentFile.parentFolderId})`);

        // 查找并更新所有同级子文件夹
        const siblingFolders = await prisma.file.findMany({
          where: {
            parentFolderId: currentFile.parentFolderId,
            id: { not: fileId }, // 排除当前文件
          },
        });

        if (siblingFolders.length > 0) {
          await prisma.file.updateMany({
            where: {
              parentFolderId: currentFile.parentFolderId,
              id: { not: fileId },
            },
            data: {
              mediaId,
              ...(episodeInfoId ? { episodeInfoId } : {}),
            },
          });
          logger.info(`已同步 ${siblingFolders.length} 个同级子文件夹`);
        }
      }

      // 如果是父文件夹，同步更新所有子文件夹
      if (currentFile.isParentFolder && currentFile.childFolders.length > 0) {
        logger.info(`检测到父文件夹，开始同步所有子文件夹...`);

        await prisma.file.updateMany({
          where: {
            parentFolderId: fileId,
          },
          data: {
            mediaId,
            ...(episodeInfoId ? { episodeInfoId } : {}),
          },
        });
        logger.info(`已同步 ${currentFile.childFolders.length} 个子文件夹`);
      }

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
    episodeNumber: number | null,
    isSpecialFolder: boolean = false,
    _parentFolder?: { id: number; path: string } | null
  ) {
    try {
      // 预处理媒体信息（如同步剧集）
      const processedMedia = await this.processMediaInfo(
        mediaInfo,
        seasonNumber,
        episodeNumber,
        isSpecialFolder
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
        episodeNumber,
        isSpecialFolder
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
    episodeNumber: number | null,
    isSpecialFolder: boolean = false
  ) {
    if (!mediaRecord) {
      return;
    }

    // 对于电视剧，还需要查找剧集信息来获取 episodeInfoId
    let episodeInfoId: number | undefined;
    if (
      mediaRecord.type === "tv" &&
      !isSpecialFolder &&
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
        errorMessage = `"${existingFile.Media?.title}" S${existingFile.episodeInfo.seasonNumber}E${existingFile.episodeInfo.episodeNumber} 已被文件关联: ${existingFile.filePath}`;
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
   * @param isSpecialFolder 是否为特殊文件夹
   * @returns 处理后的媒体信息
   */
  private async processMediaInfo(
    mediaInfo: any,
    seasonNumberInt: number | null,
    episodeNumberInt: number | null,
    isSpecialFolder: boolean = false
  ): Promise<IdentifiedMedia> {
    const media: IdentifiedMedia = { ...mediaInfo };

    // 为电视剧添加季集信息
    if (seasonNumberInt && episodeNumberInt) {
      media.seasonNumber = seasonNumberInt;
      media.episodeNumber = episodeNumberInt;
      media.episodeTitle = mediaInfo.episodeInfo.name;
    }

    // 处理电视剧剧集同步 - 合并了isTvShowWithEpisode的逻辑
    // 特殊文件夹不需要同步剧集信息（因为不关联到具体集数）
    if (
      media.type === "tv" &&
      !isSpecialFolder &&
      seasonNumberInt !== null &&
      episodeNumberInt !== null
    ) {
      logger.info(`检测到电视剧关联，触发 ${media.title} 的剧集同步...`);

      const episodeSyncResult = await this.episodeService.syncEpisodesFromTmdb(
        Number(media.tmdbId),
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
    const result = await this.mediaHardlinkerService.handleSingleFile(
      fileInfo,
      media,
      targetPath,
      true // 保存到数据库
    );

    // 创建 NFO 文件
    if (result?.linkPath) {
      const nfoPath = result.linkPath.replace(/\.[^.]+$/, '.nfo');
      createNfoFromMedia(nfoPath, media);
    }

    return result;
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
    const parentFolderId = existingFileInfo?.parentFolderId;
    if (!existingFileInfo?.linkPath || existingFileInfo.mediaId == null) {
      throw new BusinessError(
        ErrorType.VALIDATION_ERROR,
        "文件不存在或未关联媒体"
      );
    }

    // 删除旧的硬链接
    let parentInfo: ParentInfoWithChildren | null = null;
    if (parentFolderId) {
      logger.info(`发现父文件夹ID: ${parentFolderId}`);
      // 获取父文件夹信息，包含子文件夹列表（后续 handleSpecialFolderHardlink 会复用）
      parentInfo = await prisma.file.findUnique({
        where: { id: parentFolderId },
        include: {
          childFolders: true,
        },
      });
      if (!parentInfo || !parentInfo?.linkPath)
        throw new BusinessError(
          ErrorType.VALIDATION_ERROR,
          `无法获取父文件夹信息，ID: ${parentFolderId}`
        );
      logger.info(`删除父文件夹的旧硬链接: ${parentInfo.linkPath}`);
      await deleteHardlink(parentInfo.linkPath);
    } else {
      await deleteHardlink(existingFileInfo.linkPath);
      logger.info(`删除旧的硬链接: ${existingFileInfo.linkPath}`);
    }

    if (episodeTmdbId) {
      // 查找剧集信息(在创建硬链接之前)
      const episodeInfo = await this.findEpisodeInfo(
        episodeTmdbId,
        seasonNumberInt,
        episodeNumberInt
      );

      // 先更新数据库记录,清除旧的 episode_info_id
      await this.linkMediaToFile(
        fileId,
        mediaRecord.id,
        episodeInfo?.id,
        seasonNumberInt ?? undefined,
        episodeNumberInt ?? undefined
      );
    }

    // 判断是否为特殊文件夹
    if ((parentFolderId && parentInfo) || existingFileInfo.isSpecialFolder) {
      return await this.handleSpecialFolderHardlink(
        fileId,
        parentInfo,
        media,
        mediaRecord
      );
    }

    // 普通文件处理
    const targetPath = this.mediaHardlinkerService.buildTargetPath(media);
    const mediaFileLinkInfo =
      await this.mediaHardlinkerService.handleSingleFile(
        fileInfo,
        media,
        targetPath,
        false // 不直接保存到数据库，手动处理
      );

    // 更新文件记录的链接路径
    if (mediaFileLinkInfo) {
      await prisma.file.update({
        where: { id: fileId },
        data: {
          linkPath: mediaFileLinkInfo.linkPath,
        },
      });

      // 创建 NFO 文件（将视频文件扩展名替换为 .nfo）
      const nfoPath = mediaFileLinkInfo.linkPath.replace(/\.[^.]+$/, '.nfo');
      createNfoFromMedia(nfoPath, media);
    }

    // 返回更新后的完整文件信息
    return await this.getFileById(fileId);
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

  /**
   * 处理特殊文件夹的硬链接创建
   * 当文件是特殊文件夹的子卷时，需要处理整个父文件夹及其所有子文件夹
   * 当文件本身是特殊文件夹（无父文件夹）时，直接处理当前文件夹
   * @param fileId 当前文件ID
   * @param parentInfo 父文件夹信息（包含 childFolders），可为 null
   * @param media 媒体信息
   * @param mediaRecord 数据库中的媒体记录
   * @returns 更新后的文件信息
   */
  private async handleSpecialFolderHardlink(
    fileId: number,
    parentInfo: ParentInfoWithChildren | null,
    media: IdentifiedMedia,
    mediaRecord: any
  ) {
    const config = getConfig();

    // 构建目标基础路径（使用媒体标题作为标准化名称）
    const targetBasePath = path.join(config.targetFilePath, media.title);

    // 确保目标基础目录存在
    await fs.mkdir(targetBasePath, { recursive: true });
    logger.info(`[特殊文件夹] 创建目标基础目录: ${targetBasePath}`);

    // 没有父子文件夹
    if (!parentInfo) {
      const currentFile = await prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!currentFile) {
        throw new BusinessError(ErrorType.FILE_NOT_FOUND, "文件不存在");
      }

      // 递归创建硬链接
      await createHardlinkRecursively(currentFile.filePath, targetBasePath);

      // 更新当前文件的 linkPath 和媒体关联
      await prisma.file.update({
        where: { id: fileId },
        data: {
          linkPath: targetBasePath,
          mediaId: mediaRecord.id,
        },
      });

      logger.info(
        `[特殊文件夹] ✅ 已处理单独特殊文件夹: ${currentFile.filePath} -> ${targetBasePath}`
      );

      return await this.getFileById(fileId);
    }

    // 情况2：有父文件夹，处理父文件夹及其所有子文件夹
    // 更新父文件夹的 linkPath
    await prisma.file.update({
      where: { id: parentInfo.id },
      data: {
        linkPath: targetBasePath,
        mediaId: mediaRecord.id,
      },
    });
    logger.info(`[特殊文件夹] 更新父文件夹 linkPath: ${targetBasePath}`);

    // 处理所有子文件夹（包括当前文件）
    const allChildFolders = parentInfo.childFolders || [];

    for (const childFolder of allChildFolders) {
      try {
        // 根据子文件夹类型决定目标路径
        let childTargetPath: string;

        if (childFolder.isMultiDisc && childFolder.discNumber) {
          // 多卷结构：创建 "作品名/Vol.X/" 子目录
          const volumeName = `Vol.${childFolder.discNumber}`;
          childTargetPath = path.join(targetBasePath, volumeName);
          logger.info(`[特殊文件夹] 处理多卷子文件夹: ${volumeName}`);
        } else {
          // 单卷或无卷号：直接在基础目录下
          childTargetPath = targetBasePath;
          logger.info(`[特殊文件夹] 处理单卷子文件夹: ${childFolder.filePath}`);
        }

        // 创建目标子目录
        await fs.mkdir(childTargetPath, { recursive: true });

        // 递归创建硬链接
        await createHardlinkRecursively(childFolder.filePath, childTargetPath);

        // 更新子文件夹的 linkPath 和媒体关联
        await prisma.file.update({
          where: { id: childFolder.id },
          data: {
            linkPath: childTargetPath,
            mediaId: mediaRecord.id,
          },
        });

        logger.info(
          `[特殊文件夹] ✅ 已处理子文件夹: ${childFolder.filePath} -> ${childTargetPath}`
        );
      } catch (error) {
        logger.error(
          `[特殊文件夹] 处理子文件夹失败: ${childFolder.filePath}`,
          error
        );
        throw error;
      }
    }

    logger.info(
      `[特殊文件夹] 所有子文件夹处理完成，共 ${allChildFolders.length} 个`
    );

    // 返回更新后的当前文件信息
    return await this.getFileById(fileId);
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
      // 获取文件信息
      const file = await prisma.file.findUnique({
        where: { id: fileId },
        include: {
          Media: true,
          episodeInfo: true,
        },
      });

      if (!file) {
        throw new BusinessError(ErrorType.FILE_NOT_FOUND, "文件不存在");
      }

      // 检查是否为特殊文件夹
      if (file.isSpecialFolder || file.isParentFolder || file.parentFolderId) {
        throw new BusinessError(
          ErrorType.VALIDATION_ERROR,
          "暂不支持取消特殊文件夹的关联"
        );
      }

      // 如果有硬链接，删除硬链接
      if (file.linkPath) {
        logger.info(`删除硬链接: ${file.linkPath}`);
        await deleteHardlink(file.linkPath);
      }

      // 删除数据库记录
      await prisma.file.delete({
        where: { id: fileId },
      });

      logger.info(`文件${fileId}取消媒体关联成功，已删除记录和硬链接`);
      return file;
    } catch (error) {
      logger.error(`取消媒体关联失败`, error);
      throw error;
    }
  }

  // 更新特殊文件夹的碟片编号
  async updateDiscNumber(fileId: number, discNumber: number | null) {
    try {
      const file = await prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new BusinessError(ErrorType.FILE_NOT_FOUND, "文件不存在");
      }

      if (!file.isSpecialFolder) {
        throw new BusinessError(
          ErrorType.VALIDATION_ERROR,
          "只能为特殊文件夹设置碟片编号"
        );
      }

      const updatedFile = await prisma.file.update({
        where: { id: fileId },
        data: {
          discNumber: discNumber,
          isMultiDisc: discNumber !== null,
        },
        include: {
          Media: true,
          episodeInfo: true,
        },
      });

      logger.info(
        `特殊文件夹${fileId}碟片编号更新成功: ${discNumber ?? "已取消"}`
      );
      return updatedFile;
    } catch (error) {
      logger.error(`更新碟片编号失败`, error);
      throw error;
    }
  }
}
