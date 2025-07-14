import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

const prisma = new PrismaClient();

export class FileService {
  // 获取所有文件
  async getAllFiles() {
    try {
      const files = await prisma.file.findMany({
        include: {
          Media: true,
          episode: true,
        },
      });
      logger.info(`获取文件列表成功，共${files.length}个文件`);
      return files;
    } catch (error) {
      logger.error(`获取文件列表失败: ${error}`);
      throw error;
    }
  }

  // 获取单个文件详情
  async getFileById(id: number) {
    try {
      const file = await prisma.file.findUnique({
        where: { id },
        include: {
          Media: true,
          episode: true,
        },
      });

      if (!file) {
        logger.warning(`查询ID为${id}的文件不存在`);
        return null;
      }

      logger.info(`获取ID为${id}的文件详情成功`);
      return file;
    } catch (error) {
      logger.error(`获取文件${id}详情失败: ${error}`);
      throw error;
    }
  }
}

export const fileService = new FileService();
