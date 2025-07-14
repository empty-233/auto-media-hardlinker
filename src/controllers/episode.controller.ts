import { Request, Response } from "express";
import { episodeService } from "../services";
import { logger } from "../utils/logger";
import { success, badRequest, internalError } from "../utils/response";

export class EpisodeController {
  // 更新剧集信息
  static async updateEpisode(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const episodeId = parseInt(id);
      
      if (isNaN(episodeId)) {
        badRequest(res, "剧集ID必须是数字");
        return;
      }

      const { title, description, episodeNumber } = req.body;

      // 验证请求数据
      if (episodeNumber && isNaN(parseInt(episodeNumber))) {
        badRequest(res, "剧集编号必须是数字");
        return;
      }

      const updatedEpisode = await episodeService.updateEpisode(episodeId, {
        title,
        description,
        episodeNumber: episodeNumber ? parseInt(episodeNumber) : undefined,
      });

      success(res, updatedEpisode, "更新剧集信息成功");
    } catch (error) {
      logger.error(`更新剧集信息失败: ${error}`);
      console.error("更新剧集信息失败:", error);
      internalError(res, "更新剧集信息失败");
    }
  }
}

export default EpisodeController;
