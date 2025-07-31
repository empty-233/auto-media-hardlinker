import { Router } from "express";
import { FileController } from "../controllers";

const router = Router();

// 获取目录内容
router.get("/directory", FileController.getDirectoryContents);

// 获取单个文件详情
router.get("/:id", FileController.getFileById);

// 重命名文件
router.post("/rename", FileController.renameFile);

// 关联媒体文件
router.post("/:id/link-media", FileController.linkMedia);

// 取消关联媒体文件
router.post("/:id/unlink-media", FileController.unlinkMedia);

export default router;
