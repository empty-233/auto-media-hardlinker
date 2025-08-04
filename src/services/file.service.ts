import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";
import { getConfig } from "../config/config";
import fs from "fs/promises";
import path from "path";

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
}

export class FileService {
  // 获取指定目录下的文件和文件夹（不递归）
  async getDirectoryContents(dirPath?: string) {
    try {
      const config = getConfig();
      const monitorPath = path.resolve(config.monitorFilePath);

      // 处理目录路径：如果是根目录或空字符串，则使用监控根目录
      let targetPath: string;
      if (!dirPath || dirPath === '/' || dirPath === '') {
        targetPath = monitorPath;
      } else {
        // 清理路径：移除开头的斜杠，确保是相对路径
        const cleanPath = dirPath.startsWith('/') ? dirPath.slice(1) : dirPath;
        targetPath = path.join(monitorPath, cleanPath);
      }

      // 安全检查：确保目标路径在监控目录内
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

      logger.info(
        `获取目录内容成功，路径: ${targetPath}, 共${items.length}个项目`
      );
      return {
        items,
        currentPath: relativePath || "",
        parentPath: relativePath ? path.dirname(relativePath) : null,
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
          const navigationPath = path.relative(monitorPath, fullPath);
          // 添加目录项
          const stat = await fs.stat(fullPath);

          items.push({
            name: entry.name,
            path: displayPath,
            navigationPath: navigationPath,
            fullPath: fullPath,
            isDirectory: true,
            modifiedTime: stat.mtime,
            inDatabase: false,
            databaseRecord: undefined,
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
    episodeInfoId: number,
    seasonNumber?: number,
    episodeNumber?: number,
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

      if (seasonNumber !== undefined && episodeNumber !== undefined) {
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

export const fileService = new FileService();
