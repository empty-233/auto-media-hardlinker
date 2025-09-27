/**
 * @fileoverview 特殊文件夹处理工具
 * @description 统一处理BDMV、DVD等特殊文件夹结构
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'fast-glob';
import { logger } from '../../utils/logger';
import { FileProcessor, FileSource, FilePriority } from './fileProcessor';
import { PrismaClient } from '@prisma/client';

export enum SpecialFolderType {
  BDMV = 'BDMV',
  DVD_VIDEO = 'VIDEO_TS',
  ISO = 'ISO',
  NORMAL = 'NORMAL'
}

export interface SpecialFolder {
  path: string;
  type: SpecialFolderType;
  name: string;
  totalSize: number;
  fileCount: number;
}

/**
 * 特殊文件夹处理器
 */
export class SpecialFolderProcessor {
  private prisma: PrismaClient;
  private fileProcessor: FileProcessor;

  constructor(prisma: PrismaClient, fileProcessor: FileProcessor) {
    this.prisma = prisma;
    this.fileProcessor = fileProcessor;
  }

  /**
   * 识别特殊文件夹类型
   */
  public identifySpecialFolder(folderPath: string): SpecialFolderType {
    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      const dirNames = entries.filter(e => e.isDirectory()).map(e => e.name);
      const fileNames = entries.filter(e => e.isFile()).map(e => e.name);

      // 检查BDMV结构
      if (dirNames.includes('BDMV')) {
        const bdmvPath = path.join(folderPath, 'BDMV');
        if (this.isBDMVStructure(bdmvPath)) {
          return SpecialFolderType.BDMV;
        }
      }

      // 检查DVD结构
      if (dirNames.includes('VIDEO_TS')) {
        const videoTsPath = path.join(folderPath, 'VIDEO_TS');
        if (this.isDVDStructure(videoTsPath)) {
          return SpecialFolderType.DVD_VIDEO;
        }
      }

      // 检查ISO文件
      if (fileNames.some(name => name.toLowerCase().endsWith('.iso'))) {
        return SpecialFolderType.ISO;
      }

      return SpecialFolderType.NORMAL;
    } catch (error) {
      logger.warn(`识别文件夹类型失败 ${folderPath}: ${error instanceof Error ? error.message : String(error)}`);
      return SpecialFolderType.NORMAL;
    }
  }

  /**
   * 扫描并处理特殊文件夹
   */
  public async scanAndProcessSpecialFolders(basePath: string): Promise<SpecialFolder[]> {
    const specialFolders: SpecialFolder[] = [];

    try {
      const allDirs = await this.findAllDirectories(basePath);
      
      for (const dirPath of allDirs) {
        const folderType = this.identifySpecialFolder(dirPath);
        
        if (folderType !== SpecialFolderType.NORMAL) {
          const folderInfo = await this.getFolderInfo(dirPath, folderType);
          specialFolders.push(folderInfo);
          
          // 处理特殊文件夹
          await this.processSpecialFolder(folderInfo);
        }
      }
    } catch (error) {
      logger.error(`扫描特殊文件夹失败 ${basePath}`, error);
    }

    return specialFolders;
  }

  /**
   * 处理单个特殊文件夹
   */
  private async processSpecialFolder(folder: SpecialFolder): Promise<void> {
    logger.info(`处理特殊文件夹 ${folder.type}: ${folder.path}`);

    try {
      switch (folder.type) {
        case SpecialFolderType.BDMV:
          await this.processBDMVFolder(folder.path);
          break;
        case SpecialFolderType.DVD_VIDEO:
          await this.processDVDFolder(folder.path);
          break;
        case SpecialFolderType.ISO:
          await this.processISOFolder(folder.path);
          break;
        default:
          logger.warn(`不支持的特殊文件夹类型: ${folder.type}`);
      }
    } catch (error) {
      logger.error(`处理特殊文件夹失败 ${folder.path}`, error);
    }
  }

  /**
   * 处理BDMV文件夹
   */
  private async processBDMVFolder(folderPath: string): Promise<void> {
    // 找到主要的视频文件（通常是最大的.m2ts文件）
    const bdmvPath = path.join(folderPath, 'BDMV');
    const streamPath = path.join(bdmvPath, 'STREAM');
    
    if (fs.existsSync(streamPath)) {
      const m2tsFiles = await glob('*.m2ts', {
        cwd: streamPath,
        absolute: true,
        onlyFiles: true
      });

      // 找到最大的文件作为主视频
      let largestFile = '';
      let largestSize = 0;

      for (const file of m2tsFiles) {
        try {
          const stats = fs.statSync(file);
          if (stats.size > largestSize) {
            largestSize = stats.size;
            largestFile = file;
          }
        } catch (error) {
          logger.warn(`获取文件大小失败 ${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (largestFile) {
        await this.fileProcessor.processFile({
          filePath: largestFile,
          fileName: path.basename(largestFile),
          isDirectory: false,
          priority: FilePriority.SCHEDULED,
          source: FileSource.SCHEDULED_SCAN
        });
      }
    }
  }

  /**
   * 处理DVD文件夹
   */
  private async processDVDFolder(folderPath: string): Promise<void> {
    const videoTsPath = path.join(folderPath, 'VIDEO_TS');
    
    if (fs.existsSync(videoTsPath)) {
      const vobFiles = await glob('*.VOB', {
        cwd: videoTsPath,
        absolute: true,
        onlyFiles: true
      });

      // 处理所有VOB文件
      for (const vobFile of vobFiles) {
        await this.fileProcessor.processFile({
          filePath: vobFile,
          fileName: path.basename(vobFile),
          isDirectory: false,
          priority: FilePriority.SCHEDULED,
          source: FileSource.SCHEDULED_SCAN
        });
      }
    }
  }

  /**
   * 处理ISO文件夹
   */
  private async processISOFolder(folderPath: string): Promise<void> {
    const isoFiles = await glob('*.iso', {
      cwd: folderPath,
      absolute: true,
      onlyFiles: true,
      caseSensitiveMatch: false
    });

    for (const isoFile of isoFiles) {
      // ISO文件直接当作视频文件处理
      await this.fileProcessor.processFile({
        filePath: isoFile,
        fileName: path.basename(isoFile),
        isDirectory: false,
        priority: FilePriority.SCHEDULED,
        source: FileSource.SCHEDULED_SCAN
      });
    }
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
      return entries.some(entry => entry.toUpperCase().endsWith('.VOB') || entry.toUpperCase().endsWith('.IFO'));
    } catch {
      return false;
    }
  }

  /**
   * 获取文件夹信息
   */
  private async getFolderInfo(folderPath: string, folderType: SpecialFolderType): Promise<SpecialFolder> {
    let totalSize = 0;
    let fileCount = 0;

    try {
      const allFiles = await glob('**/*', {
        cwd: folderPath,
        absolute: true,
        onlyFiles: true
      });

      fileCount = allFiles.length;

      for (const file of allFiles) {
        try {
          const stats = fs.statSync(file);
          totalSize += stats.size;
        } catch {
          // 忽略无法访问的文件
        }
      }
    } catch (error) {
      logger.warn(`获取文件夹信息失败 ${folderPath}: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      path: folderPath,
      type: folderType,
      name: path.basename(folderPath),
      totalSize,
      fileCount
    };
  }

  /**
   * 查找所有目录
   */
  private async findAllDirectories(basePath: string): Promise<string[]> {
    try {
      const dirs = await glob('*/', {
        cwd: basePath,
        absolute: true,
        onlyDirectories: true
      });
      return dirs;
    } catch (error) {
      logger.warn(`查找目录失败 ${basePath}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}