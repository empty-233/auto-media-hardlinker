import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";
import { ImageUrlHelper } from "../utils/imageUrl";

const prisma = new PrismaClient();

export class DashboardService {
  // 获取仪表板统计信息
  async getDashboardStats() {
    try {
      // 获取媒体总数
      const totalMedia = await prisma.media.count();
      
      // 获取文件总数
      const totalFiles = await prisma.file.count();
      
      // 获取各类型媒体数量
      const mediaByType = await prisma.media.groupBy({
        by: ['type'],
        _count: {
          id: true,
        },
      });
      
      // 获取文件大小统计
      const fileSizeStats = await prisma.file.aggregate({
        _sum: {
          fileSize: true,
        },
      });
      
      // 获取最近添加的媒体（只取前10个）
      const recentMedia = await prisma.media.findMany({
        take: 10,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          title: true,
          type: true,
          releaseDate: true,
          posterUrl: true,
          createdAt: true,
          _count: {
            select: {
              files: true,
            },
          },
        },
      });
      
      // 处理最近媒体的图片URL
      const processedRecentMedia = ImageUrlHelper.processMediaListImageUrls(recentMedia);
      
      // 计算存储空间使用率（假设总容量10TB）
      const totalStorageBytes = Number(fileSizeStats._sum?.fileSize || 0n);
      const totalStorageGB = totalStorageBytes / (1024 * 1024 * 1024);
      const totalStorageTB = totalStorageGB / 1024;
      const maxStorageTB = 10; // 假设最大存储10TB
      const storageUsagePercent = (totalStorageTB / maxStorageTB) * 100;
      
      // 格式化媒体类型统计
      const typeStats = {
        movie: 0,
        tv: 0,
        collection: 0,
      };
      
      mediaByType.forEach(item => {
        if (item.type === 'movie') typeStats.movie = item._count.id;
        else if (item.type === 'tv') typeStats.tv = item._count.id;
        else if (item.type === 'collection') typeStats.collection = item._count.id;
      });
      
      const dashboardData = {
        totalMedia,
        totalFiles,
        totalStorageBytes,
        totalStorageGB: Math.round(totalStorageGB * 100) / 100,
        totalStorageTB: Math.round(totalStorageTB * 100) / 100,
        storageUsagePercent: Math.round(storageUsagePercent * 100) / 100,
        typeStats,
        recentMedia: processedRecentMedia,
      };
      
      logger.info(`获取仪表板统计信息成功: 媒体${totalMedia}条，文件${totalFiles}个，存储${totalStorageTB.toFixed(2)}TB`);
      return dashboardData;
    } catch (error) {
      logger.error(`获取仪表板统计信息失败`, error);
      throw error;
    }
  }

  // 获取最近添加的媒体
  async getRecentMedia(limit: number = 10) {
    try {
      const recentMedia = await prisma.media.findMany({
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          files: true,
          tvInfos: {
            include: {
              episodes: true,
            },
          },
          movieInfo: true,
          collectionInfo: true,
        },
      });
      
      // 处理图片URL
      const processedRecentMedia = ImageUrlHelper.processMediaListImageUrls(recentMedia);
      
      logger.info(`获取最近添加的媒体成功，共${recentMedia.length}条记录`);
      return processedRecentMedia;
    } catch (error) {
      logger.error(`获取最近添加的媒体失败`, error);
      throw error;
    }
  }

  // 获取存储空间详细信息
  async getStorageInfo() {
    try {
      // 获取总文件大小
      const totalSizeResult = await prisma.file.aggregate({
        _sum: {
          fileSize: true,
        },
      });
      
      // 按媒体类型分组统计文件大小
      const sizeByType = await prisma.file.groupBy({
        by: ['mediaId'],
        _sum: {
          fileSize: true,
        },
        where: {
          mediaId: {
            not: null,
          },
        },
      });
      
      // 获取各媒体类型的文件大小统计
      const mediaIds = sizeByType.map(item => item.mediaId!);
      const mediaWithTypes = await prisma.media.findMany({
        where: {
          id: {
            in: mediaIds,
          },
        },
        select: {
          id: true,
          type: true,
        },
      });
      
      // 按类型聚合文件大小
      const typeSizeMap = new Map<string, bigint>();
      sizeByType.forEach(item => {
        const media = mediaWithTypes.find(m => m.id === item.mediaId);
        if (media && item._sum.fileSize) {
          const currentSize = typeSizeMap.get(media.type) || 0n;
          typeSizeMap.set(media.type, currentSize + item._sum.fileSize);
        }
      });
      
      const totalStorageBytes = Number(totalSizeResult._sum?.fileSize || 0n);
      const totalStorageGB = totalStorageBytes / (1024 * 1024 * 1024);
      const totalStorageTB = totalStorageGB / 1024;
      
      const storageInfo = {
        totalBytes: totalStorageBytes,
        totalGB: Math.round(totalStorageGB * 100) / 100,
        totalTB: Math.round(totalStorageTB * 100) / 100,
        byType: {
          movie: Math.round(Number(typeSizeMap.get('movie') || 0n) / (1024 * 1024 * 1024) * 100) / 100,
          tv: Math.round(Number(typeSizeMap.get('tv') || 0n) / (1024 * 1024 * 1024) * 100) / 100,
          collection: Math.round(Number(typeSizeMap.get('collection') || 0n) / (1024 * 1024 * 1024) * 100) / 100,
        },
      };
      
      logger.info(`获取存储空间信息成功: 总计${storageInfo.totalTB}TB`);
      return storageInfo;
    } catch (error) {
      logger.error(`获取存储空间信息失败`, error);
      throw error;
    }
  }
}

export const dashboardService = new DashboardService();
