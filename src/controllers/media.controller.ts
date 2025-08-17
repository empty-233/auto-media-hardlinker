import { Request, Response } from "express";
import { Type } from "@prisma/client";
import { MediaService } from "../services";
import { logger } from "../utils/logger";
import {
  success,
  notFound,
  internalError,
  successWithPagination,
} from "../utils/response";

export class MediaController {
  constructor(private mediaService: MediaService) {}

  // 获取所有媒体列表
  getAllMedia = async (req: Request, res: Response) => {
    try {
      // 使用验证中间件验证后的数据
      const { page, limit, keyword } = req.query as any;
      const mediaData = await this.mediaService.getAllMedia(page, limit, keyword);
      successWithPagination(res, mediaData, "获取媒体列表成功");
    } catch (error) {
      logger.error(`获取媒体列表失败`, error);
      internalError(res, "获取媒体列表失败");
    }
  }

  // 获取单个媒体详情
  getMediaById = async (req: Request, res: Response) => {
    try {
      // 使用验证中间件验证后的数据
      const { id } = req.params as any;
      const media = await this.mediaService.getMediaById(id);
      
      if (!media) {
        notFound(res, "媒体不存在");
        return;
      }

      success(res, media, "获取媒体详情成功");
    } catch (error) {
      logger.error(`获取媒体详情失败`, error);
      internalError(res, "获取媒体详情失败");
    }
  }

  // 按类型获取媒体
  getMediaByType = async (req: Request, res: Response) => {
    try {
      // 使用验证中间件验证后的数据
      const { type } = req.params as any;
      const { page, limit, keyword } = req.query as any;

      const mediaData = await this.mediaService.getMediaByType(
        type as Type,
        page,
        limit,
        keyword
      );
      successWithPagination(res, mediaData, `获取${type}类型媒体列表成功`);
    } catch (error) {
      logger.error(`获取媒体列表失败`, error);
      internalError(res, "获取媒体列表失败");
    }
  }
}
