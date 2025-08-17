import { Router } from "express";
import { FileController } from "../controllers";
import { FileService, EpisodeService, TMDBService } from "../services";
import { MediaRepository } from "../repository/media.repository";
import { MediaHardlinkerService } from "../core/mediaHardlinker";
import {
  ValidationMiddleware,
  FileValidators,
  FileParamValidators,
  QueryValidators
} from "../validators";

const tmdbService = TMDBService.getInstance();
const episodeService = new EpisodeService(tmdbService);
const fileService = new FileService();
const mediaRepository = new MediaRepository();
const mediaHardlinkerService = new MediaHardlinkerService();
const fileController = new FileController(fileService, episodeService, mediaHardlinkerService, mediaRepository);

const router = Router();

// 获取目录内容
router.get(
  "/directory",
  ValidationMiddleware.query(QueryValidators.directoryPath),
  fileController.getDirectoryContents
);

// 获取单个文件详情
router.get(
  "/:id",
  ValidationMiddleware.params(FileParamValidators.fileId),
  fileController.getFileById
);

// 重命名文件
router.post(
  "/rename",
  ValidationMiddleware.body(FileValidators.renameFile),
  fileController.renameFile
);

// 关联媒体文件
router.post(
  "/:id/link-media",
  ValidationMiddleware.body(FileValidators.linkMedia),
  fileController.linkMedia
);

// 取消关联媒体文件
router.post(
  "/:id/unlink-media",
  ValidationMiddleware.params(FileParamValidators.fileId),
  fileController.unlinkMedia
);

export default router;
