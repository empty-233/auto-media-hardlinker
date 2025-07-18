import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

const prisma = new PrismaClient();

export class EpisodeService {
  // 更新剧集信息
  async updateEpisode(id: number, data: { title?: string; description?: string; episodeNumber?: number }) {
    try {
      const { title, description, episodeNumber } = data;

      // 验证请求数据
      if (episodeNumber && isNaN(episodeNumber)) {
        throw new Error("剧集编号必须是数字");
      }

      const updatedEpisode = await prisma.episodeInfo.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(episodeNumber !== undefined ? { episodeNumber } : {}),
        },
      });

      logger.info(`更新ID为${id}的剧集信息成功`);
      return updatedEpisode;
    } catch (error) {
      logger.error(`更新剧集${id}信息失败`, error);
      throw error;
    }
  }
}

export const episodeService = new EpisodeService();
