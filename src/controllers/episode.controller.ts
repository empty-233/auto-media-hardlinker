import { Request, Response } from "express";
import { episodeService } from "../services";
import { logger } from "../utils/logger";
import { success, internalError } from "../utils/response";

export class EpisodeController {
  // 更新剧集信息
  static async updateEpisode(req: Request, res: Response) {
    try {
      // 使用验证中间件验证后的数据，不再需要手动验证
      const { id } = req.params;
      const { title, description, episodeNumber } = req.body;

      const updatedEpisode = await episodeService.updateEpisode(parseInt(id), {
        title,
        description,
        episodeNumber
      });

      success(res, updatedEpisode, "更新剧集信息成功");
    } catch (error) {
      logger.error(`更新剧集信息失败`, error);
      internalError(res, "更新剧集信息失败");
    }
  }
}

export default EpisodeController;
