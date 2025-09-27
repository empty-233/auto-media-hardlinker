import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'fast-glob';
import { PrismaClient } from '@prisma/client';
import { getConfig } from '../../config/config';
import { logger } from '../../utils/logger';
import { getContainer } from './container';
import { FileProcessor } from './fileProcessor';
import { SpecialFolderProcessor } from './specialFolderProcessor';

// 重新导出特殊文件夹类型
export { SpecialFolderType } from './specialFolderProcessor';

/**
 * 库文件状态枚举
 */
export enum LibraryStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  ERROR = 'ERROR',
  IGNORED = 'IGNORED'
}

/**
 * 扫描结果接口
 */
export interface ScanResult {
  filesFound: number;
  filesAdded: number;
  duration: number;
  errors: string[];
}

/**
 * 文件信息接口
 */
export interface FileInfo {
  path: string;
  type: 'video' | 'subtitle';
  size: number;
  pathHash: string;
}

/**
 * 文件夹结构信息接口
 */
export interface FolderStructure {
  path: string;
  name: string;
  files: string[];
  subdirs: FolderStructure[];
}

/**
 * 媒体库扫描器
 */
export class LibraryScanner {
  private prisma: PrismaClient;
  private fileProcessor: FileProcessor;
  private specialFolderProcessor: SpecialFolderProcessor;
  private config = getConfig();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    const container = getContainer();
    this.fileProcessor = container.getFileProcessor();
    this.specialFolderProcessor = container.getSpecialFolderProcessor();
  }

  /**
   * 扫描所有配置的库路径
   */
  async scanAllLibraries(): Promise<ScanResult> {
    const startTime = Date.now();
    let totalFilesFound = 0;
    let totalFilesAdded = 0;
    const allErrors: string[] = [];

    try {
      const libraryPath = this.config.monitorFilePath;
      logger.info(`开始扫描库路径: ${libraryPath}`);
      
      const result = await this.scanLibraryPath(libraryPath);
      totalFilesFound += result.filesFound;
      totalFilesAdded += result.filesAdded;
      allErrors.push(...result.errors);
      
      logger.info(`库路径 ${libraryPath} 扫描完成: 发现 ${result.filesFound} 个文件，新增 ${result.filesAdded} 个`);

      const duration = Date.now() - startTime;
      
      // 记录扫描日志
      await this.logScanResult({
        scanPath: this.config.monitorFilePath,
        filesFound: totalFilesFound,
        filesAdded: totalFilesAdded,
        duration,
        errors: allErrors,
        status: allErrors.length > 0 ? 'error' : 'success'
      });

      return {
        filesFound: totalFilesFound,
        filesAdded: totalFilesAdded,
        duration,
        errors: allErrors
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error('扫描库失败', error);
      
      await this.logScanResult({
        scanPath: this.config.monitorFilePath,
        filesFound: totalFilesFound,
        filesAdded: totalFilesAdded,
        duration: Date.now() - startTime,
        errors: [...allErrors, errorMessage],
        status: 'error'
      });

      throw error;
    }
  }

  /**
   * 扫描单个库路径
   */
  private async scanLibraryPath(libraryPath: string): Promise<ScanResult> {
    if (!fs.existsSync(libraryPath)) {
      const error = `库路径不存在: ${libraryPath}`;
      logger.error(error);
      return { filesFound: 0, filesAdded: 0, duration: 0, errors: [error] };
    }

    const startTime = Date.now();
    const errors: string[] = [];
    let filesFound = 0;
    let filesAdded = 0;

    try {
      // 构建文件扩展名匹配模式
      const videoExtensions = this.config.videoExtensions.map(ext => ext.toLowerCase());
      const subtitleExtensions = this.config.subtitleExtensions.map(ext => ext.toLowerCase());
      const allExtensions = [...videoExtensions, ...subtitleExtensions];
      
      const patterns = allExtensions.map(ext => 
        `**/*${ext}`
      );

      // 使用 fast-glob 递归扫描文件
      const files = await glob(patterns, {
        cwd: libraryPath,
        absolute: true,
        caseSensitiveMatch: false,
        onlyFiles: true
      });

      filesFound = files.length;

      // 处理找到的文件
      const fileInfos: FileInfo[] = [];
      for (const filePath of files) {
        try {
          const stat = fs.statSync(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const type = videoExtensions.includes(ext) ? 'video' : 'subtitle';
          const pathHash = this.fileProcessor.generatePathHash(filePath);

          fileInfos.push({
            path: filePath,
            type,
            size: stat.size,
            pathHash
          });
        } catch (error) {
          const errorMessage = `获取文件信息失败 ${filePath}: ${error instanceof Error ? error.message : '未知错误'}`;
          errors.push(errorMessage);
          logger.warn(errorMessage);
        }
      }

      // 批量处理文件信息
      filesAdded = await this.processFileInfos(fileInfos, errors);

      // 检查特殊文件夹结构
      await this.processSpecialFolders(libraryPath, errors);

    } catch (error) {
      const errorMessage = `扫描路径失败 ${libraryPath}: ${error instanceof Error ? error.message : '未知错误'}`;
      errors.push(errorMessage);
      logger.error(errorMessage, error);
    }

    return {
      filesFound,
      filesAdded,
      duration: Date.now() - startTime,
      errors
    };
  }

  /**
   * 批量处理文件信息
   */
  private async processFileInfos(fileInfos: FileInfo[], errors: string[]): Promise<number> {
    let filesAdded = 0;

    // 获取已存在的文件哈希
    const pathHashes = fileInfos.map(info => info.pathHash);
    const existingFiles = await this.prisma.library.findMany({
      where: {
        pathHash: {
          in: pathHashes
        }
      },
      select: {
        pathHash: true
      }
    });
    const existingHashSet = new Set(existingFiles.map(f => f.pathHash));

    // 筛选出新文件
    const newFiles = fileInfos.filter(info => !existingHashSet.has(info.pathHash));

    // 批量插入新文件
    if (newFiles.length > 0) {
      try {
        const createData = newFiles.map(info => ({
          type: info.type,
          path: info.path,
          pathHash: info.pathHash,
          size: BigInt(info.size),
          status: LibraryStatus.PENDING
        }));

        await this.prisma.library.createMany({
          data: createData
        });

        filesAdded = newFiles.length;
        logger.info(`新增 ${filesAdded} 个文件到库中`);

        // 将新发现的视频文件推送到队列进行刮削
        await this.enqueueNewVideoFiles(newFiles);
      } catch (error) {
        const errorMessage = `批量插入文件失败: ${error instanceof Error ? error.message : '未知错误'}`;
        errors.push(errorMessage);
        logger.error(errorMessage, error);
      }
    }

    return filesAdded;
  }

  /**
   * 将新发现的视频文件推送到队列进行刮削
   */
  private async enqueueNewVideoFiles(newFiles: FileInfo[]): Promise<void> {
    try {
      // 使用文件处理器统一处理新发现的文件
      await this.fileProcessor.handleScannedFiles(newFiles);
    } catch (error) {
      logger.error('推送新视频文件到队列失败', error);
      // 不抛出错误，避免影响扫描流程的继续执行
    }
  }

  /**
   * 处理特殊文件夹结构（BDMV、DVD等）
   */
  private async processSpecialFolders(basePath: string, errors: string[]): Promise<void> {
    try {
      // 使用专门的特殊文件夹处理器
      const specialFolders = await this.specialFolderProcessor.scanAndProcessSpecialFolders(basePath);
      
      if (specialFolders.length > 0) {
        logger.info(`发现 ${specialFolders.length} 个特殊文件夹`);
        specialFolders.forEach(folder => {
          logger.info(`  - ${folder.type}: ${folder.name} (${folder.fileCount} 个文件, ${Math.round(folder.totalSize / 1024 / 1024)}MB)`);
        });
      }
    } catch (error) {
      const errorMessage = `处理特殊文件夹失败 ${basePath}: ${error instanceof Error ? error.message : '未知错误'}`;
      errors.push(errorMessage);
      logger.error(errorMessage, error);
    }
  }

  /**
   * 记录扫描日志
   */
  private async logScanResult(result: {
    scanPath: string;
    filesFound: number;
    filesAdded: number;
    duration: number;
    errors: string[];
    status: string;
  }): Promise<void> {
    try {
      await this.prisma.scanLog.create({
        data: {
          scanTime: new Date(),
          scanPath: result.scanPath,
          filesFound: result.filesFound,
          filesAdded: result.filesAdded,
          duration: result.duration,
          errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
          status: result.status
        }
      });
    } catch (error) {
      logger.error('记录扫描日志失败', error);
    }
  }

  /**
   * 获取扫描日志
   */
  async getScanLogs(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    
    const [logs, total] = await Promise.all([
      this.prisma.scanLog.findMany({
        orderBy: { scanTime: 'desc' },
        skip: offset,
        take: limit
      }),
      this.prisma.scanLog.count()
    ]);

    return {
      logs: logs.map(log => ({
        id: log.id,
        scanTime: log.scanTime.toISOString(),
        scanPath: log.scanPath,
        filesFound: log.filesFound,
        filesAdded: log.filesAdded,
        duration: log.duration,
        errors: log.errors ? JSON.parse(log.errors) : [],
        status: log.status,
        createdAt: log.createdAt.toISOString()
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 获取库文件统计信息
   */
  async getLibraryStats() {
    const [
      total,
      pending,
      processed,
      error,
      ignored,
      videoCount,
      subtitleCount
    ] = await Promise.all([
      this.prisma.library.count(),
      this.prisma.library.count({ where: { status: LibraryStatus.PENDING } }),
      this.prisma.library.count({ where: { status: LibraryStatus.PROCESSED } }),
      this.prisma.library.count({ where: { status: LibraryStatus.ERROR } }),
      this.prisma.library.count({ where: { status: LibraryStatus.IGNORED } }),
      this.prisma.library.count({ where: { type: 'video' } }),
      this.prisma.library.count({ where: { type: 'subtitle' } })
    ]);

    return {
      total,
      pending,
      processed,
      error,
      ignored,
      videoCount,
      subtitleCount
    };
  }
}
