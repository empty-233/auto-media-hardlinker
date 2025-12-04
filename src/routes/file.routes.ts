import { Router } from "express";
import { FileController } from "../controllers";
import { FileService, EpisodeService, TMDBService } from "../services";
import { MediaRepository } from "../repository/media.repository";
import { MediaHardlinkerService } from "../core/fileManage/mediaHardlinker";
import { createValidator } from "../middleware/validation.middleware";
import { ParamValidators, FileValidators } from "../validators";

const tmdbService = TMDBService.getInstance();
const episodeService = new EpisodeService(tmdbService);
const mediaRepository = new MediaRepository();
const mediaHardlinkerService = new MediaHardlinkerService();
const fileService = new FileService(mediaHardlinkerService, mediaRepository, episodeService);
const fileController = new FileController(fileService);

const router = Router();

// 获取目录内容
router.get(
  "/directory",
  createValidator({
    query: FileValidators.getDirectoryContents
  }),
  fileController.getDirectoryContents
);

// 获取单个文件详情
router.get(
  "/:id",
  createValidator({
    params: ParamValidators.id
  }),
  fileController.getFileById
);

// 重命名文件
router.post(
  "/rename",
  createValidator({
    body: FileValidators.renameFile
  }),
  fileController.renameFile
);

// 关联媒体文件
router.post(
  "/:id/link-media",
  createValidator({
    params: ParamValidators.idOrNew,
    body: FileValidators.linkMedia
  }),
  fileController.linkMedia
);

// 取消关联媒体文件
router.post(
  "/:id/unlink-media",
  createValidator({
    params: ParamValidators.id
  }),
  fileController.unlinkMedia
);

// 更新碟片编号
router.patch(
  "/:id/disc-number",
  createValidator({
    params: ParamValidators.id,
    body: FileValidators.updateDiscNumber
  }),
  fileController.updateDiscNumber
);

export default router;