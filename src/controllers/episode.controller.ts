import { Request, Response } from "express";
import { EpisodeService } from "../services";
import { logger } from "../utils/logger";
import { success, internalError } from "../utils/response";

export class EpisodeController {
  constructor(private episodeService: EpisodeService) {}

  // 更新剧集信息
  updateEpisode = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { title, description, episodeNumber } = req.body;

      const updatedEpisode = await this.episodeService.updateEpisode(parseInt(id), {
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
