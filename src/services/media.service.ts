import { PrismaClient, Type, Prisma } from "@prisma/client";
import { logger } from "../utils/logger";
import { ImageUrlHelper } from "../utils/imageUrl";

const prisma = new PrismaClient();

export class MediaService {
  // 获取所有媒体列表
  async getAllMedia(page: number = 1, limit: number = 10, keyword?: string) {
    try {
      const skip = (page - 1) * limit;
      const take = limit;

      // 注意: 由于使用的是SQLite, Prisma的 'insensitive' 模式不受支持，
      // 因此这里的搜索是区分大小写的。
      const where: Prisma.MediaWhereInput = {};
      if (keyword) {
        where.OR = [
          { title: { contains: keyword } },
          { originalTitle: { contains: keyword } },
        ];
      }

      const [media, total] = await prisma.$transaction([
        prisma.media.findMany({
          where,
          skip,
          take,
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
          orderBy: {
            id: 'desc'
          }
        }),
        prisma.media.count({ where }),
      ]);

      // 处理图片URL
      const processedMedia = ImageUrlHelper.processMediaListImageUrls(media);

      logger.info(`获取媒体列表成功，共${total}条记录, 第${page}页, 每页${limit}条`);
      return {
        items: processedMedia,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error(`获取媒体列表失败`, error);
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
        logger.warn(`查询ID为${id}的媒体不存在`);
        return null;
      }

      // 处理图片URL
      const processedMedia = ImageUrlHelper.processMediaImageUrl(media);

      logger.info(`获取ID为${id}的媒体详情成功`);
      return processedMedia;
    } catch (error) {
      logger.error(`获取媒体${id}详情失败`, error);
      throw error;
    }
  }

  // 按类型获取媒体
  async getMediaByType(
    type: Type,
    page: number = 1,
    limit: number = 10,
    keyword?: string
  ) {
    try {
      if (!Object.values(Type).includes(type)) {
        logger.warn(`请求了无效的媒体类型: ${type}`);
        throw new Error("无效的媒体类型");
      }
      const skip = (page - 1) * limit;
      const take = limit;

      // 注意: 由于使用的是SQLite, Prisma的 'insensitive' 模式不受支持，
      // 因此这里的搜索是区分大小写的。
      const where: Prisma.MediaWhereInput = { type };
      if (keyword) {
        where.OR = [
          { title: { contains: keyword } },
          { originalTitle: { contains: keyword } },
        ];
      }

      const [media, total] = await prisma.$transaction([
        prisma.media.findMany({
          where,
          skip,
          take,
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
          orderBy: {
            id: 'desc'
          }
        }),
        prisma.media.count({ where }),
      ]);

      // 处理图片URL
      const processedMedia = ImageUrlHelper.processMediaListImageUrls(media);

      logger.info(
        `获取${type}类型媒体列表成功，共${total}条记录, 第${page}页, 每页${limit}条`
      );
      return {
        items: processedMedia,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error(`获取${type}类型媒体失败`, error);
      throw error;
    }
  }
}

export const mediaService = new MediaService();
