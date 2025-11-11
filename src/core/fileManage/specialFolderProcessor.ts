/**
 * @fileoverview 特殊文件夹处理工具
 * @description 统一处理BDMV、DVD等特殊文件夹结构，集成 LLM 识别和硬链接功能
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { generatePathHash } from '../../utils/hash';
import { createHardlinkRecursively } from '../../utils/hardlink';
import { FileProcessor } from './fileProcessor';
import { PrismaClient, LibraryStatus } from '@prisma/client';
import { getConfig } from '../../config/config';
import { getQueueService } from '../../queue/queueService';
import { LLMIdentifier, LLMFolderIdentification } from '../../strategies/llm.identifier';
import { SpecialFolderType, SpecialFolder, SpecialFolderProcessResult } from '../../types/specialFolder.types';

/**
 * 特殊文件夹处理器
 */
export class SpecialFolderProcessor {
  private prisma: PrismaClient;
  private fileProcessor: FileProcessor;
  private config = getConfig();
  private identifier: LLMIdentifier;

  constructor(prisma: PrismaClient, fileProcessor: FileProcessor) {
    this.prisma = prisma;
    this.fileProcessor = fileProcessor;
    this.identifier = new LLMIdentifier();
  }

  /**
   * 快速判断文件夹是否可能是特殊结构
   * 只有当文件夹内全都是媒体文件（无子文件夹）时才跳过
   * 其他所有情况都交给队列由 LLM 判断
   * @returns {isPotential: boolean, shouldUseParent: boolean}
   *   - isPotential: 是否可能是特殊文件夹
   *   - shouldUseParent: 是否应该使用父文件夹（当子文件夹包含特殊结构时）
   */
  public async isPotentialSpecialFolder(folderPath: string): Promise<{
    isPotential: boolean;
    shouldUseParent: boolean;
  }> {
    try {
      const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
      const videoExtensions = this.config.videoExtensions.map(ext => ext.toLowerCase());
      
      // 检查是否全都是媒体文件
      const files = entries.filter(entry => entry.isFile());
      const videoFiles = files.filter(file => {
        const ext = path.extname(file.name).toLowerCase();
        return videoExtensions.includes(ext);
      });
      
      // 如果全都是媒体文件（或者没有文件），跳过
      if (files.length > 0 && videoFiles.length === files.length) {
        // logger.debug(`快速判断：普通文件夹，跳过: ${folderPath} (${videoFiles.length} 个视频)`);
        return { isPotential: false, shouldUseParent: false };
      }
      
      // 其他情况（有非视频文件）交给 LLM 处理
      logger.debug(`文件夹包含非视频文件，交给 LLM 判断: ${folderPath}`);
      return { isPotential: true, shouldUseParent: false };
    } catch (error) {
      logger.warn(`快速检查文件夹失败 ${folderPath}: ${error instanceof Error ? error.message : String(error)}`);
      return { isPotential: false, shouldUseParent: false };
    }
  }

  /**
   * 批量添加文件夹到队列进行异步处理
   * 由 libraryScanner 调用，快速入队
   */
  public async enqueueFoldersForProcessing(folderPaths: string[]): Promise<void> {
    logger.info(`准备将 ${folderPaths.length} 个文件夹添加到队列`);

    try {
      // 快速添加到数据库（标记为 PENDING）
      const records = folderPaths.map(folderPath => ({
        type: 'folder',
        path: folderPath,
        pathHash: generatePathHash(folderPath),
        size: BigInt(0), // 初始大小为 0，队列处理时计算
        isDirectory: true,
        status: LibraryStatus.PENDING
      }));

      // 逐个添加，避免重复
      for (const record of records) {
        try {
          // 先尝试查找已存在的记录
          const existing = await this.prisma.library.findFirst({
            where: { pathHash: record.pathHash }
          });

          if (existing) {
            // 如果存在，更新状态
            await this.prisma.library.update({
              where: { id: existing.id },
              data: { status: LibraryStatus.PENDING }
            });
          } else {
            // 如果不存在，创建新记录
            await this.prisma.library.create({
              data: record
            });
          }
        } catch (error: any) {
          logger.warn(`添加文件夹记录失败 ${record.path}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // 确保队列服务已启动
      await this.fileProcessor.ensureQueueService();

      // 批量添加到队列（高优先级）
      const queueService = getQueueService();
      const tasks = folderPaths.map(folderPath => ({
        filePath: folderPath,
        fileName: path.basename(folderPath),
        isDirectory: true,
        priority: 10 // 特殊文件夹优先级较高
      }));

      await queueService.enqueueTasks(tasks);

      logger.info(`已将 ${folderPaths.length} 个文件夹添加到队列，等待异步处理`);
    } catch (error) {
      logger.error('批量入队失败', error);
      throw error;
    }
  }



  /**
   * 在父文件夹中搜索匹配的子文件夹
   * @param parentPath 父文件夹路径
   * @param subFolderName 子文件夹名称（由 LLM 提供）
   * @returns 找到的子文件夹完整路径，未找到则返回 null
   */
  private async findSubFolder(parentPath: string, subFolderName: string): Promise<string | null> {
    try {
      const entries = await fs.promises.readdir(parentPath, { withFileTypes: true });
      
      // 精确匹配
      const exactMatch = entries.find(
        entry => entry.isDirectory() && entry.name === subFolderName
      );
      
      if (exactMatch) {
        const fullPath = path.join(parentPath, exactMatch.name);
        logger.debug(`[搜索] 精确匹配子文件夹: ${exactMatch.name}`);
        return fullPath;
      }
      
      // 大小写不敏感匹配
      const caseInsensitiveMatch = entries.find(
        entry => entry.isDirectory() && entry.name.toLowerCase() === subFolderName.toLowerCase()
      );
      
      if (caseInsensitiveMatch) {
        const fullPath = path.join(parentPath, caseInsensitiveMatch.name);
        logger.debug(`[搜索] 大小写不敏感匹配子文件夹: ${caseInsensitiveMatch.name}`);
        return fullPath;
      }
      
      // 模糊匹配（包含关系）
      const fuzzyMatch = entries.find(
        entry => entry.isDirectory() && (
          entry.name.includes(subFolderName) || 
          subFolderName.includes(entry.name)
        )
      );
      
      if (fuzzyMatch) {
        const fullPath = path.join(parentPath, fuzzyMatch.name);
        logger.debug(`[搜索] 模糊匹配子文件夹: ${fuzzyMatch.name}`);
        return fullPath;
      }
      
      logger.warn(`[搜索] 未找到匹配的子文件夹: ${subFolderName} (在 ${parentPath})`);
      return null;
    } catch (error) {
      logger.error(`[搜索] 读取父文件夹失败 ${parentPath}:`, error);
      return null;
    }
  }

  /**
   * 处理单个特殊文件夹并返回结果（供 TaskProcessor 调用）
   * 职责：LLM识别 → TMDB刮削 → 创建硬链接
   * 不负责：保存数据库（由 TaskProcessor 统一处理）
   * @returns 返回处理结果数组，每个结果包含文件夹信息、链接路径和媒体信息
   * @throws {Error} - LLM 识别失败时抛出错误，让队列重试
   */
  public async processFolder(folderPath: string): Promise<SpecialFolderProcessResult[]> {
    logger.info(`[特殊文件夹] 开始处理: ${folderPath}`);

    // LLM 一次性识别整个文件夹结构
    logger.debug(`[特殊文件夹] 步骤1: LLM 识别文件夹结构...`);
    
    const identifications = await this.identifier.identifyFolder(
      folderPath,
      this.config.scanConfig.scanMaxDepth || 2
    );
    
    if (!identifications || identifications.length === 0) {
      logger.warn(`[特殊文件夹] LLM未给出结果，可能不是特殊文件夹: ${folderPath}`);
      return [];
    }

    // 过滤掉 NORMAL 类型
    const validIdentifications = identifications.filter(id => id.type !== 'NORMAL');
    
    if (validIdentifications.length === 0) {
      logger.warn(`[特殊文件夹] 不是特殊结构: ${folderPath}`);
      return [];
    }

    logger.info(`[特殊文件夹] 识别到 ${validIdentifications.length} 个特殊内容`);

    // 处理每个识别到的文件夹
    const results: SpecialFolderProcessResult[] = [];

    for (const identification of validIdentifications) {
      try {
        // 定位实际文件夹路径
        let actualFolderPath: string;
        
        if (identification.subFolderName) {
          const foundPath = await this.findSubFolder(folderPath, identification.subFolderName);
          if (!foundPath) {
            logger.warn(`[特殊文件夹] 未找到子文件夹: ${identification.subFolderName}`);
            continue;
          }
          actualFolderPath = foundPath;
        } else {
          actualFolderPath = folderPath;
        }
        
        const contentDesc = identification.contentType === 'main' 
          ? '主要内容' 
          : `特殊内容(${identification.contentType})`;
        const volumeInfo = identification.isMultiDisc && identification.discNumber
          ? ` [卷 ${identification.discNumber}]`
          : '';
          
        logger.info(`[特殊文件夹] 处理${contentDesc}${volumeInfo}: ${identification.subFolderName || path.basename(actualFolderPath)}`);
        
        // 处理单个文件夹
        const result = await this.processSingleFolder(actualFolderPath, identification);
        
        if (result) {
          results.push(result);
        }
      } catch (error) {
        logger.error(`[特殊文件夹] 处理失败: ${identification.subFolderName || folderPath}`, error);
      }
    }

    logger.info(`[特殊文件夹] ✅ 处理完成: ${folderPath} (共 ${results.length} 个内容)`);
    
    return results;
  }

  /**
   * 处理单个特殊文件夹（只负责识别和创建硬链接，不保存数据库）
   * @param folderPath 文件夹路径
   * @param identification LLM 识别结果（必须传入，避免重复识别）
   * @returns 返回处理结果，包含媒体信息和文件夹详情，供调用方保存到数据库
   */
  private async processSingleFolder(
    folderPath: string, 
    identification: LLMFolderIdentification
  ): Promise<SpecialFolderProcessResult | null> {
    const pathHash = generatePathHash(folderPath);

    logger.debug(`[队列] 处理特殊文件夹: ${folderPath}`);
    logger.debug(`  - 标题: ${identification.title}`);
    logger.debug(`  - 类型: ${identification.type}`);

    // 计算文件夹大小和文件数量
    logger.debug(`[队列] 步骤2: 计算文件夹大小...`);
    const folderInfo = await this.getFolderInfo(folderPath, identification);
    logger.debug(`[队列] 文件夹大小: ${(folderInfo.totalSize / 1024 / 1024 / 1024).toFixed(2)} GB, 文件数: ${folderInfo.fileCount}`);

    // TMDB 刮削获取标准化名称和完整媒体信息
    logger.debug(`[队列] 步骤3: TMDB 刮削...`);
    const mediaInfo = await this.identifier.scrapeMediaInfoForFolder(
      folderInfo.name,
      folderInfo.year,
      identification.mediaType // 传递 LLM 判断的媒体类型
    );
    
    if (!mediaInfo) {
      logger.warn(`[队列] 无法获取媒体信息，标记为忽略: ${folderPath}`);
      await this.prisma.library.updateMany({
        where: { pathHash },
        data: { 
          status: LibraryStatus.IGNORED,
          lastProcessedAt: new Date()
        }
      });
      return null;
    }

    logger.info(`[队列] TMDB 标准化名称: ${mediaInfo.standardizedName}`);
    folderInfo.standardizedName = mediaInfo.standardizedName;
    folderInfo.tmdbId = mediaInfo.tmdbId;
    
    // 创建硬链接
    logger.debug(`[队列] 步骤4: 创建硬链接...`);
    const linkPath = await this.createFolderHardlink(folderInfo);

    if (!linkPath) {
      logger.error(`[队列] 创建硬链接失败: ${folderPath}`);
      return null;
    }

    return {
      folderInfo,
      linkPath,
      mediaInfo
    };
  }

  /**
   * 创建文件夹硬链接
   * 支持多卷结构和特殊内容（SP、特典等）的正确目录结构
   * @returns 目标文件夹路径
   */
  private async createFolderHardlink(folder: SpecialFolder): Promise<string | null> {
    if (!folder.standardizedName) {
      logger.warn(`缺少标准化名称，无法创建硬链接: ${folder.name}`);
      return null;
    }

    const targetBasePath = this.config.targetFilePath;
    
    // 去掉标准化名称中可能存在的卷号后缀
    let baseStandardizedName = folder.standardizedName.replace(/\s*Vol\.\d+\s*$/, '');
    
    // 根据内容类型和卷信息决定目标路径
    let targetFolderPath: string;
    
    if (folder.contentType === 'main' && folder.isMultiDisc && folder.discNumber) {
      // 主要内容 + 多卷：创建 "作品名/Vol.X/" 结构
      const volumeName = `Vol.${folder.discNumber}`;
      targetFolderPath = path.join(targetBasePath, baseStandardizedName, volumeName);
      logger.info(`[多卷] 创建卷子目录: ${baseStandardizedName}/${volumeName}`);
    } else if (folder.contentType !== 'main') {
      // 特殊内容（SP、特典等）：创建 "作品名/SP/" 或 "作品名/Bonus/" 等子目录
      const contentTypeFolderName = this.getContentTypeFolderName(folder.contentType);
      targetFolderPath = path.join(targetBasePath, baseStandardizedName, contentTypeFolderName);
      logger.info(`[特殊内容] 创建子目录: ${baseStandardizedName}/${contentTypeFolderName}`);
    } else {
      // 单卷主要内容：直接创建 "作品名/" 结构
      targetFolderPath = path.join(targetBasePath, baseStandardizedName);
      logger.info(`[单卷] 创建作品目录: ${baseStandardizedName}`);
    }

    try {
      // 创建目标文件夹（包括多级目录）
      await fs.promises.mkdir(targetFolderPath, { recursive: true });
      logger.debug(`目标文件夹已创建: ${targetFolderPath}`);

      // 使用统一的硬链接工具递归创建硬链接
      await createHardlinkRecursively(folder.path, targetFolderPath);
      
      logger.info(`✅ 硬链接创建完成: ${folder.path} -> ${targetFolderPath}`);
      
      return targetFolderPath;
    } catch (error) {
      logger.error(`❌ 创建硬链接失败: ${folder.path}`, error);
      throw error;
    }
  }

  /**
   * 根据内容类型获取文件夹名称
   */
  private getContentTypeFolderName(contentType: string): string {
    const folderNameMap: Record<string, string> = {
      'sp': 'SP',
      'bonus': 'Bonus',
      'menu': 'Menu',
      'pv': 'PV',
      'ova': 'OVA',
      'other': 'Other'
    };
    
    return folderNameMap[contentType] || 'Other';
  }

  /**
   * 获取文件夹详细信息
   */
  private async getFolderInfo(
    folderPath: string,
    identification: LLMFolderIdentification
  ): Promise<SpecialFolder> {
    let totalSize = 0;
    let fileCount = 0;

    try {
      // 递归计算文件夹大小和文件数量
      await this.calculateFolderSize(folderPath, (size) => {
        totalSize += size;
        fileCount++;
      });
    } catch (error) {
      logger.warn(`计算文件夹大小失败 ${folderPath}: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      path: folderPath,
      type: identification.type as SpecialFolderType,
      name: identification.title,
      originalName: identification.originalName,
      totalSize,
      fileCount,
      isMultiDisc: identification.isMultiDisc,
      discNumber: identification.discNumber,
      contentType: identification.contentType,
      year: identification.year
    };
  }

  /**
   * 递归计算文件夹大小
   */
  private async calculateFolderSize(
    folderPath: string,
    onFile: (size: number) => void
  ): Promise<void> {
    try {
      const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);
        
        if (entry.isDirectory()) {
          await this.calculateFolderSize(fullPath, onFile);
        } else {
          try {
            const stats = await fs.promises.stat(fullPath);
            onFile(stats.size);
          } catch {
            // 忽略无法访问的文件
          }
        }
      }
    } catch (error) {
      logger.warn(`读取目录失败 ${folderPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

}