import { Router } from "express";
import { FileController } from "../controllers";
import { 
  ValidationMiddleware,
  FileValidators,
  FileParamValidators,
  QueryValidators
} from "../validators";

const router = Router();

// 获取目录内容
router.get(
  "/directory", 
  ValidationMiddleware.query(QueryValidators.directoryPath),
  FileController.getDirectoryContents
);

// 获取单个文件详情
router.get(
  "/:id", 
  ValidationMiddleware.params(FileParamValidators.fileId),
  FileController.getFileById
);

// 重命名文件
router.post(
  "/rename", 
  ValidationMiddleware.body(FileValidators.renameFile),
  FileController.renameFile
);

// 关联媒体文件
router.post(
  "/:id/link-media", 
  ValidationMiddleware.params(FileParamValidators.fileId),
  ValidationMiddleware.body(FileValidators.linkMedia),
  FileController.linkMedia
);

// 取消关联媒体文件
router.post(
  "/:id/unlink-media", 
  ValidationMiddleware.params(FileParamValidators.fileId),
  FileController.unlinkMedia
);

export default router;
