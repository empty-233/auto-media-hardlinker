import { Request, Response } from "express";
import { Type } from "@prisma/client";
import { mediaService } from "../services";
import { logger } from "../utils/logger";
import {
  success,
  badRequest,
  notFound,
  internalError,
  successWithPagination,
} from "../utils/response";

export class MediaController {
  // 获取所有媒体列表
  static async getAllMedia(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const keyword = req.query.keyword as string | undefined;
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
      const { id } = req.params;
      const mediaId = parseInt(id);
      
      if (isNaN(mediaId)) {
        badRequest(res, "媒体ID必须是数字");
        return;
      }

      const media = await mediaService.getMediaById(mediaId);
      
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
      const { type } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const keyword = req.query.keyword as string | undefined;

      if (!Object.values(Type).includes(type as Type)) {
        badRequest(res, "无效的媒体类型");
        return;
      }

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
