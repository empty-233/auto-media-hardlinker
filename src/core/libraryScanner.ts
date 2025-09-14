import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { glob } from 'fast-glob';
import { PrismaClient } from '@prisma/client';
import { getConfig } from '../config/config';
import { logger } from '../utils/logger';
import { MediaHardlinkerService } from './mediaHardlinker';
import { getQueueService } from '../queue/queueService';
import { ScrapingTaskData } from '../types/queue.types';

/**
 * 特殊文件夹结构类型
 */
export enum SpecialFolderType {
  BDMV = 'BDMV',
  DVD_VIDEO = 'VIDEO_TS',
  NORMAL = 'NORMAL'
}

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
  private mediaHardlinker: MediaHardlinkerService;
  private config = getConfig();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.mediaHardlinker = new MediaHardlinkerService();
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
          const pathHash = this.generatePathHash(filePath);

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
      // 只处理视频文件，跳过字幕文件
      const videoFiles = newFiles.filter(file => file.type === 'video');
      
      if (videoFiles.length === 0) {
        return;
      }

      const queueService = getQueueService();
      
      // 确保队列服务已启动
      if (!queueService.isRunning()) {
        await queueService.start();
        logger.info('队列服务已自动启动');
      }

      // 准备任务数据
      const taskDataList: ScrapingTaskData[] = videoFiles.map(file => ({
        filePath: file.path,
        fileName: path.basename(file.path),
        isDirectory: false,
        priority: 1, // 扫描发现的文件优先级设为1
        maxRetries: this.config.queue?.defaultMaxRetries
      }));

      // 批量添加到队列
      const taskIds = await queueService.enqueueTasks(taskDataList);
      
      logger.info(`已将 ${videoFiles.length} 个新发现的视频文件推送到队列进行刮削，任务ID: [${taskIds.join(', ')}]`);
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
      // 递归查找特殊文件夹
      const specialFolders = await this.findSpecialFolders(basePath);
      
      for (const folder of specialFolders) {
        try {
          await this.processSpecialFolder(folder, errors);
        } catch (error) {
          const errorMessage = `处理特殊文件夹失败 ${folder.path}: ${error instanceof Error ? error.message : '未知错误'}`;
          errors.push(errorMessage);
          logger.error(errorMessage, error);
        }
      }
    } catch (error) {
      const errorMessage = `查找特殊文件夹失败 ${basePath}: ${error instanceof Error ? error.message : '未知错误'}`;
      errors.push(errorMessage);
      logger.error(errorMessage, error);
    }
  }

  /**
   * 查找特殊文件夹结构
   */
  private async findSpecialFolders(basePath: string): Promise<{ path: string; type: SpecialFolderType }[]> {
    const specialFolders: { path: string; type: SpecialFolderType }[] = [];

    const findSpecialInDir = async (dirPath: string) => {
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const fullPath = path.join(dirPath, entry.name);
            
            // 检查是否是BDMV结构
            if (entry.name === 'BDMV' && this.isBDMVStructure(fullPath)) {
              specialFolders.push({ path: path.dirname(fullPath), type: SpecialFolderType.BDMV });
            }
            // 检查是否是DVD结构
            else if (entry.name === 'VIDEO_TS' && this.isDVDStructure(fullPath)) {
              specialFolders.push({ path: path.dirname(fullPath), type: SpecialFolderType.DVD_VIDEO });
            }
            // 递归检查子目录
            else {
              await findSpecialInDir(fullPath);
            }
          }
        }
      } catch (error) {
        logger.warn(`读取目录失败 ${dirPath}: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    };

    await findSpecialInDir(basePath);
    return specialFolders;
  }

  /**
   * 检查是否是BDMV结构
   */
  private isBDMVStructure(bdmvPath: string): boolean {
    try {
      const requiredDirs = ['STREAM', 'CLIPINF', 'PLAYLIST'];
      const entries = fs.readdirSync(bdmvPath);
      return requiredDirs.some(dir => entries.includes(dir));
    } catch {
      return false;
    }
  }

  /**
   * 检查是否是DVD结构
   */
  private isDVDStructure(videoTsPath: string): boolean {
    try {
      const entries = fs.readdirSync(videoTsPath);
      return entries.some(entry => entry.endsWith('.VOB') || entry.endsWith('.IFO'));
    } catch {
      return false;
    }
  }

  /**
   * 处理特殊文件夹
   */
  private async processSpecialFolder(folder: { path: string; type: SpecialFolderType }, errors: string[]): Promise<void> {
    logger.info(`发现特殊文件夹结构 ${folder.type}: ${folder.path}`);
    
    // 获取文件夹结构信息
    const structure = this.getFolderStructure(folder.path);
    
    // 使用LLM判断是否需要刮削
    const shouldProcess = await this.shouldProcessSpecialFolder(structure);
    
    if (shouldProcess) {
      try {
        // 直接硬链接整个文件夹的所有文件
        await this.hardlinkSpecialFolder(folder.path, errors);
      } catch (error) {
        const errorMessage = `硬链接特殊文件夹失败 ${folder.path}: ${error instanceof Error ? error.message : '未知错误'}`;
        errors.push(errorMessage);
        logger.error(errorMessage, error);
      }
    }
  }

  /**
   * 获取文件夹结构
   */
  private getFolderStructure(folderPath: string): FolderStructure {
    const name = path.basename(folderPath);
    const files: string[] = [];
    const subdirs: FolderStructure[] = [];

    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile()) {
          files.push(entry.name);
        } else if (entry.isDirectory()) {
          const subdir = this.getFolderStructure(path.join(folderPath, entry.name));
          subdirs.push(subdir);
        }
      }
    } catch (error) {
      logger.warn(`读取文件夹结构失败 ${folderPath}: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    return { path: folderPath, name, files, subdirs };
  }

  /**
   * 判断是否应该处理特殊文件夹（使用LLM）
   */
  private async shouldProcessSpecialFolder(structure: FolderStructure): Promise<boolean> {
    // 简化逻辑：如果文件夹包含视频文件就处理
    const hasVideoFiles = this.hasVideoFilesInStructure(structure);
    return hasVideoFiles;
  }

  /**
   * 检查文件夹结构中是否包含视频文件
   */
  private hasVideoFilesInStructure(structure: FolderStructure): boolean {
    const videoExtensions = this.config.videoExtensions.map(ext => ext.toLowerCase());
    
    // 检查当前文件夹的文件
    const hasVideo = structure.files.some(file => {
      const ext = path.extname(file).toLowerCase();
      return videoExtensions.includes(ext);
    });
    
    if (hasVideo) return true;
    
    // 递归检查子文件夹
    return structure.subdirs.some(subdir => this.hasVideoFilesInStructure(subdir));
  }

  /**
   * 硬链接特殊文件夹的所有文件
   */
  private async hardlinkSpecialFolder(folderPath: string, errors: string[]): Promise<void> {
    const allFiles = await this.getAllFilesInFolder(folderPath);
    
    for (const filePath of allFiles) {
      try {
        // 使用现有的硬链接逻辑
        await this.mediaHardlinker.createHardlinkForFile(filePath);
      } catch (error) {
        const errorMessage = `硬链接文件失败 ${filePath}: ${error instanceof Error ? error.message : '未知错误'}`;
        errors.push(errorMessage);
        logger.warn(errorMessage);
      }
    }
  }

  /**
   * 获取文件夹中的所有文件
   */
  private async getAllFilesInFolder(folderPath: string): Promise<string[]> {
    const files = await glob('**/*', {
      cwd: folderPath,
      absolute: true,
      onlyFiles: true
    });
    return files;
  }

  /**
   * 生成路径哈希
   */
  private generatePathHash(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex');
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
