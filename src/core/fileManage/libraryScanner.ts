import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'fast-glob';
import { PrismaClient } from '@/generated/client';
import { getConfig } from '@/config/config';
import { logger } from '@/utils/logger';
import { generatePathHash } from '@/utils/hash';
import { getContainer } from './container';
import { FileProcessor } from './fileProcessor';
import { SpecialFolderProcessor } from './specialFolderProcessor';

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
      logger.info(`开始统一扫描库路径: ${libraryPath}`);
      
      // 扫描所有文件夹
      const scanMaxDepth = this.config.scanConfig.scanMaxDepth;
      const allFolders = await this.scanFolders(libraryPath, scanMaxDepth);

      // 识别和处理特殊文件夹
      const { specialFolders, processedPaths } = await this.identifyAndProcessSpecialFolders(
        allFolders, 
        errors
      );
      
      logger.info(`特殊文件夹处理完成: ${specialFolders} 个`);

      //扫描普通视频和字幕文件（排除已处理的特殊文件夹）
      const normalFiles = await this.scanNormalFiles(
        libraryPath, 
        processedPaths,
        errors
      );
      
      filesFound = normalFiles.length;

      // 批量处理普通文件
      filesAdded = await this.processFileInfos(normalFiles, errors);

      logger.info(`普通文件处理完成: 发现 ${filesFound} 个，新增 ${filesAdded} 个`);

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
   * 扫描所有文件夹
   */
  private async scanFolders(basePath: string, maxDepth: number): Promise<string[]> {
    try {
      const patterns: string[] = [];
      for (let depth = 1; depth <= maxDepth; depth++) {
        const pattern = '*'.repeat(depth) + '/';
        patterns.push(pattern);
      }

      logger.debug(`扫描文件夹，深度: ${maxDepth}, 模式: ${patterns.join(', ')}`);

      const folders = await glob(patterns, {
        cwd: basePath,
        onlyDirectories: true,
        deep: maxDepth,
        absolute: true,
        followSymbolicLinks: false,
        suppressErrors: true
      });

      logger.debug(`文件夹扫描完成，找到 ${folders.length} 个文件夹`);
      return folders;
    } catch (error) {
      logger.error(`文件夹扫描失败 ${basePath}`, error);
      return [];
    }
  }

  /**
   * 识别和处理特殊文件夹（快速扫描 + 队列处理）
   */
  private async identifyAndProcessSpecialFolders(
    folders: string[],
    errors: string[]
  ): Promise<{ specialFolders: number; processedPaths: Set<string> }> {
    const processedPaths = new Set<string>();
    let specialFolderCount = 0;

    try {
      // 批量查询数据库中已存在的文件夹
      const existingFolders = await this.prisma.library.findMany({
        where: {
          path: {
            in: folders
          }
        },
        select: {
          path: true,
          type: true,
          status: true
        }
      });

      // 构建已存在文件夹的映射
      const existingFolderMap = new Map(
        existingFolders.map(f => [f.path, { type: f.type, status: f.status }])
      );

      logger.debug(`数据库中已存在 ${existingFolders.length} 个文件夹记录`);

      // 快速收集可能的特殊文件夹（基础规则判断，不调用 LLM）
      const foldersToQueue: string[] = [];

      for (const folderPath of folders) {
        try {
          // 检查是否是已处理特殊文件夹的子文件夹
          const isSubfolderOfProcessed = Array.from(processedPaths).some(
            processed => folderPath.startsWith(processed + path.sep)
          );
          
          if (isSubfolderOfProcessed) {
            // logger.debug(`跳过已处理特殊文件夹的子文件夹: ${folderPath}`);
            continue;
          }

          // 检查数据库中是否已存在
          const existing = existingFolderMap.get(folderPath);
          if (existing) {
            // logger.debug(`文件夹已存在于数据库: ${folderPath} (类型: ${existing.type}, 状态: ${existing.status})`);
            
            // 如果是文件夹类型，添加到已处理路径
            if (existing.type === 'folder') {
              processedPaths.add(folderPath);
              specialFolderCount++;
            }
            continue;
          }

          //使用快速规则判断是否可能是特殊文件夹（不调用 LLM）
          const checkResult = await this.specialFolderProcessor.isPotentialSpecialFolder(folderPath);
          
          if (checkResult.isPotential) {
            // 如果检测到子文件夹包含特殊结构，推送父文件夹
            const folderToQueue = checkResult.shouldUseParent 
              ? path.dirname(folderPath) 
              : folderPath;
            
            if (!foldersToQueue.includes(folderToQueue)) {
              logger.info(`发现可能的特殊文件夹: ${folderToQueue}`);
              foldersToQueue.push(folderToQueue);
              processedPaths.add(folderToQueue);
              specialFolderCount++;
              
            }
          }
        } catch (error) {
          const errorMessage = `检查文件夹失败 ${folderPath}: ${error instanceof Error ? error.message : '未知错误'}`;
          errors.push(errorMessage);
          logger.warn(errorMessage);
        }
      }

      // 快速添加到队列
      if (foldersToQueue.length > 0) {
        logger.info(`发现 ${foldersToQueue.length} 个可能的特殊文件夹，添加到队列进行异步处理`);
        await this.specialFolderProcessor.enqueueFoldersForProcessing(foldersToQueue);
      }

    } catch (error) {
      const errorMessage = `特殊文件夹扫描失败: ${error instanceof Error ? error.message : '未知错误'}`;
      errors.push(errorMessage);
      logger.error(errorMessage, error);
    }

    return { specialFolders: specialFolderCount, processedPaths };
  }

  /**
   * 扫描普通文件（排除特殊文件夹）
   */
  private async scanNormalFiles(
    libraryPath: string,
    excludePaths: Set<string>,
    errors: string[]
  ): Promise<FileInfo[]> {
    try {
      // 构建文件扩展名匹配模式
      const videoExtensions = this.config.videoExtensions.map(ext => ext.toLowerCase());
      const subtitleExtensions = this.config.subtitleExtensions.map(ext => ext.toLowerCase());
      const allExtensions = [...videoExtensions, ...subtitleExtensions];
      
      const patterns = allExtensions.map(ext => `**/*${ext}`);

      // 使用 fast-glob 递归扫描文件
      const files = await glob(patterns, {
        cwd: libraryPath,
        absolute: true,
        caseSensitiveMatch: false,
        onlyFiles: true
      });

      // 过滤掉特殊文件夹内的文件
      const filteredFiles = files.filter(filePath => {
        return !Array.from(excludePaths).some(excludePath => 
          filePath.startsWith(excludePath + path.sep)
        );
      });

      logger.info(`文件扫描完成: 总共 ${files.length} 个，过滤后 ${filteredFiles.length} 个`);

      // 处理找到的文件
      const fileInfos: FileInfo[] = [];
      for (const filePath of filteredFiles) {
        try {
          const stat = fs.statSync(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const type = videoExtensions.includes(ext) ? 'video' : 'subtitle';
          const pathHash = generatePathHash(filePath);

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

      return fileInfos;
    } catch (error) {
      logger.error(`普通文件扫描失败 ${libraryPath}`, error);
      return [];
    }
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
          isDirectory: false,
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
