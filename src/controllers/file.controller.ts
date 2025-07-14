import { Request, Response } from "express";
import { fileService } from "../services";
import { logger } from "../utils/logger";
import { success, badRequest, notFound, internalError } from "../utils/response";

export class FileController {
  // 获取所有文件
  static async getAllFiles(req: Request, res: Response) {
    try {
      const files = await fileService.getAllFiles();
      success(res, files, "获取文件列表成功");
    } catch (error) {
      logger.error(`获取文件列表失败: ${error}`);
      console.error("获取文件列表失败:", error);
      internalError(res, "获取文件列表失败");
    }
  }

  // 获取单个文件详情
  static async getFileById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const fileId = parseInt(id);
      
      if (isNaN(fileId)) {
        badRequest(res, "文件ID必须是数字");
        return;
      }

      const file = await fileService.getFileById(fileId);
      
      if (!file) {
        notFound(res, "文件不存在");
        return;
      }

      success(res, file, "获取文件详情成功");
    } catch (error) {
      logger.error(`获取文件详情失败: ${error}`);
      console.error("获取文件详情失败:", error);
      internalError(res, "获取文件详情失败");
    }
  }
}

export default FileController;
