import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { LibraryScanner } from '../core/libraryScanner';
import { ScanScheduler } from '../core/scanScheduler';
import * as fs from "fs";
import * as path from "path";
import { getConfig, clearConfigCache, type ScanConfig } from '../config/config';

const prisma = new PrismaClient();

export interface LibraryStats {
  total: number;
  videoCount: number;
  subtitleCount: number;
  pending: number;
  processed: number;
  error: number;
  ignored: number;
}

export interface ScanLogResult {
  logs: Array<{
    id: number;
    scanTime: string;
    scanPath: string;
    filesFound: number;
    filesAdded: number;
    duration: number;
    errors: string[];
    status: string;
    createdAt: string;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LibraryFileResult {
  files: Array<{
    id: number;
    type: string;
    path: string;
    size: number;
    status: string;
    lastProcessedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ScanService {
  private scanner: LibraryScanner;

  constructor(private scanScheduler: ScanScheduler) {
    this.scanner = new LibraryScanner(prisma);
  }

  /**
   * 获取扫描状态
   */
  async getScanStatus(): Promise<{ isScanning: boolean; stats: LibraryStats }> {
    const isScanning = this.scanScheduler.isScanning();
    const stats = await this.getLibraryStats();
    
    return {
      isScanning,
      stats
    };
  }

  /**
   * 触发手动扫描
   */
  async triggerScan(): Promise<{ message: string }> {
    if (this.scanScheduler.isScanning()) {
      return { message: '扫描已在进行中' };
    }

    // 异步执行扫描
    this.scanScheduler.triggerScan().catch(error => {
      logger.error('手动扫描失败', error);
    });

    return { message: '扫描已启动' };
  }

  /**
   * 获取库统计信息
   */
  async getLibraryStats(): Promise<LibraryStats> {
    const [
      total,
      videoCount,
      subtitleCount,
      pending,
      processed,
      error,
      ignored
    ] = await Promise.all([
      prisma.library.count(),
      prisma.library.count({ where: { type: 'video' } }),
      prisma.library.count({ where: { type: 'subtitle' } }),
      prisma.library.count({ where: { status: 'PENDING' } }),
      prisma.library.count({ where: { status: 'PROCESSED' } }),
      prisma.library.count({ where: { status: 'ERROR' } }),
      prisma.library.count({ where: { status: 'IGNORED' } })
    ]);

    return {
      total,
      videoCount,
      subtitleCount,
      pending,
      processed,
      error,
      ignored
    };
  }

  /**
   * 获取扫描日志
   */
  async getScanLogs(
    page: number, 
    limit: number,
    sortBy: string,
    sortOrder: 'asc' | 'desc'
  ): Promise<ScanLogResult> {
    const offset = (page - 1) * limit;

    // 构建排序条件
    const orderBy: any = {};
    switch (sortBy) {
      case 'scanTime':
        orderBy.scanTime = sortOrder;
        break;
      case 'duration':
        orderBy.duration = sortOrder;
        break;
      case 'filesFound':
        orderBy.filesFound = sortOrder;
        break;
      case 'filesAdded':
        orderBy.filesAdded = sortOrder;
        break;
      default:
        orderBy.scanTime = 'desc'; // 默认按扫描时间倒序
    }

    const [logs, total] = await Promise.all([
      prisma.scanLog.findMany({
        orderBy,
        skip: offset,
        take: limit
      }),
      prisma.scanLog.count()
    ]);

    const formattedLogs = logs.map(log => ({
      id: log.id,
      scanTime: log.scanTime.toISOString(),
      scanPath: log.scanPath,
      filesFound: log.filesFound,
      filesAdded: log.filesAdded,
      duration: log.duration,
      errors: log.errors ? JSON.parse(log.errors) : [],
      status: log.status,
      createdAt: log.createdAt.toISOString()
    }));

    return {
      logs: formattedLogs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 获取库文件列表
   */
  async getLibraryFiles(
    page: number = 1,
    limit: number = 20,
    type?: string,
    status?: string
  ): Promise<LibraryFileResult> {
    const offset = (page - 1) * limit;

    // 构建查询条件
    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const [files, total] = await Promise.all([
      prisma.library.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.library.count({ where })
    ]);

    const formattedFiles = files.map(file => ({
      id: file.id,
      type: file.type,
      path: file.path,
      size: Number(file.size),
      status: file.status,
      lastProcessedAt: file.lastProcessedAt?.toISOString() || null,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString()
    }));

    return {
      files: formattedFiles,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 删除库文件记录
   */
  async deleteLibraryFile(id: number): Promise<void> {
    await prisma.library.delete({
      where: { id }
    });
  }

  /**
   * 重新处理库文件
   */
  async reprocessLibraryFile(id: number): Promise<void> {
    await prisma.library.update({
      where: { id },
      data: {
        status: 'PENDING',
        lastProcessedAt: null,
        updatedAt: new Date()
      }
    });
  }

  /**
   * 获取扫描配置
   */
  async getScanConfig(): Promise<ScanConfig> {
    const config = getConfig();
    return config.scanConfig;
  }

  /**
   * 更新扫描配置
   */
  async updateScanConfig(scanConfig: Partial<ScanConfig>): Promise<ScanConfig> {
    try {
      // 读取当前配置
      const configPath = path.join(process.cwd(), 'config/config.json');
      const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      
      // 更新扫描配置
      currentConfig.scanConfig = {
        ...currentConfig.scanConfig,
        ...scanConfig
      };
      
      // 写入配置文件
      fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 4), 'utf-8');
      
      // 清除配置缓存
      clearConfigCache();
      
      // 更新扫描调度器配置
      this.scanScheduler.updateConfig();
      
      logger.info(`扫描配置已更新: ${JSON.stringify(currentConfig.scanConfig)}`);
      
      return currentConfig.scanConfig;
    } catch (error) {
      logger.error('更新扫描配置失败', error);
      throw new Error('更新扫描配置失败');
    }
  }
}
