import { Router } from "express";
import { FileController } from "../controllers";

const router = Router();

// 获取所有文件
router.get("/", FileController.getAllFiles);

// 获取单个文件详情
router.get("/:id", FileController.getFileById);

export default router;
