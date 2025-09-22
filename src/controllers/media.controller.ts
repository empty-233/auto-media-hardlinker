import { Response } from "express";
import { MediaService } from "../services";
import {
  success,
  notFound,
  successWithPagination,
} from "../utils/response";
import { TypedController, TypedRequest } from "./base.controller";
import { ParamValidators, MediaParamValidators, MediaQueryValidators } from "../validators";
import { z } from "zod";

// 类型定义
type MediaQueryType = z.infer<typeof MediaQueryValidators.list>;
type IdParamType = z.infer<typeof ParamValidators.id>;
type TypeParamType = z.infer<typeof MediaParamValidators.type>;

export class MediaController extends TypedController {
  constructor(private mediaService: MediaService) {
    super();
  }

  // 获取所有媒体列表
  getAllMedia = this.asyncHandler<{}, MediaQueryType>(
    async (req: TypedRequest<{}, MediaQueryType>, res: Response) => {
      const { page, limit, keyword } = req.query;
      const mediaData = await this.mediaService.getAllMedia(page, limit, keyword);
      successWithPagination(res, mediaData, "获取媒体列表成功");
    }
  );

  // 获取单个媒体详情
  getMediaById = this.asyncHandler<IdParamType>(
    async (req: TypedRequest<IdParamType>, res: Response) => {
      const { id } = req.params;
      const media = await this.mediaService.getMediaById(id);
      
      if (!media) {
        notFound(res, "媒体不存在");
        return;
      }

      success(res, media, "获取媒体详情成功");
    }
  );

  // 按类型获取媒体
  getMediaByType = this.asyncHandler<TypeParamType, MediaQueryType>(
    async (req: TypedRequest<TypeParamType, MediaQueryType>, res: Response) => {
      const { type } = req.params;
      const { page, limit, keyword } = req.query;
      
      const mediaData = await this.mediaService.getMediaByType(
        type,
        page,
        limit,
        keyword
      );
      successWithPagination(res, mediaData, "获取媒体列表成功");
    }
  );
}