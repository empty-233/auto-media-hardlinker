import { Request, Response } from "express";
import { Type } from "@prisma/client";
import { mediaService } from "../services";
import { logger } from "../utils/logger";
import {
  success,
  notFound,
  internalError,
  successWithPagination,
} from "../utils/response";

export class MediaController {
  // 获取所有媒体列表
  static async getAllMedia(req: Request, res: Response) {
    try {
      // 使用验证中间件验证后的数据
      const { page, limit, keyword } = req.query as any;
      const mediaData = await mediaService.getAllMedia(page, limit, keyword);
      successWithPagination(res, mediaData, "获取媒体列表成功");
    } catch (error) {
      logger.error(`获取媒体列表失败`, error);
      internalError(res, "获取媒体列表失败");
    }
  }

  // 获取单个媒体详情
  static async getMediaById(req: Request, res: Response) {
    try {
      // 使用验证中间件验证后的数据
      const { id } = req.params as any;
      const media = await mediaService.getMediaById(id);
      
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
  static async getMediaByType(req: Request, res: Response) {
    try {
      // 使用验证中间件验证后的数据
      const { type } = req.params as any;
      const { page, limit, keyword } = req.query as any;

      const mediaData = await mediaService.getMediaByType(
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

export default MediaController;
