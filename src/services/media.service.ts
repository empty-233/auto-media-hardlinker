import { PrismaClient, Type } from "@prisma/client";
import { logger } from "../utils/logger";
import { ImageUrlHelper } from "../utils/imageUrl";

const prisma = new PrismaClient();

export class MediaService {
  // 获取所有媒体列表
  async getAllMedia() {
    try {
      const media = await prisma.media.findMany({
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
      const processedMedia = ImageUrlHelper.processMediaListImageUrls(media);
      
      logger.info(`获取媒体列表成功，共${media.length}条记录`);
      return processedMedia;
    } catch (error) {
      logger.error(`获取媒体列表失败: ${error}`);
      throw error;
    }
  }

  // 获取单个媒体详情
  async getMediaById(id: number) {
    try {
      const media = await prisma.media.findUnique({
        where: { id },
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

      if (!media) {
        logger.warning(`查询ID为${id}的媒体不存在`);
        return null;
      }

      // 处理图片URL
      const processedMedia = ImageUrlHelper.processMediaImageUrl(media);

      logger.info(`获取ID为${id}的媒体详情成功`);
      return processedMedia;
    } catch (error) {
      logger.error(`获取媒体${id}详情失败: ${error}`);
      throw error;
    }
  }

  // 按类型获取媒体
  async getMediaByType(type: Type) {
    try {
      if (!Object.values(Type).includes(type)) {
        logger.warning(`请求了无效的媒体类型: ${type}`);
        throw new Error("无效的媒体类型");
      }

      const media = await prisma.media.findMany({
        where: { type },
        include: {
          files: true,
          tvInfos:
            type === "tv"
              ? {
                  include: {
                    episodes: true,
                  },
                }
              : undefined,
          movieInfo: type === "movie" ? true : undefined,
          collectionInfo: type === "collection" ? true : undefined,
        },
      });

      // 处理图片URL
      const processedMedia = ImageUrlHelper.processMediaListImageUrls(media);

      logger.info(`获取${type}类型媒体列表成功，共${media.length}条记录`);
      return processedMedia;
    } catch (error) {
      logger.error(`获取${type}类型媒体失败: ${error}`);
      throw error;
    }
  }
}

export const mediaService = new MediaService();
