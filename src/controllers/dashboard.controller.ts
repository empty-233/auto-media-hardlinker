import { Request, Response } from "express";
import { dashboardService } from "../services";
import { logger } from "../utils/logger";
import { success, internalError } from "../utils/response";

export class DashboardController {
  // 获取仪表板统计信息
  static async getDashboardStats(req: Request, res: Response) {
    try {
      const dashboardData = await dashboardService.getDashboardStats();
      success(res, dashboardData, '获取仪表板统计信息成功');
    } catch (error) {
      logger.error(`获取仪表板统计信息失败: ${error}`);
      console.error("获取仪表板统计信息失败:", error);
      internalError(res, "获取仪表板统计信息失败");
    }
  }

  // 获取最近添加的媒体
  static async getRecentMedia(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const recentMedia = await dashboardService.getRecentMedia(limit);
      success(res, recentMedia, '获取最近添加的媒体成功');
    } catch (error) {
      logger.error(`获取最近添加的媒体失败: ${error}`);
      console.error("获取最近添加的媒体失败:", error);
      internalError(res, "获取最近添加的媒体失败");
    }
  }

  // 获取存储空间详细信息
  static async getStorageInfo(req: Request, res: Response) {
    try {
      const storageInfo = await dashboardService.getStorageInfo();
      success(res, storageInfo, '获取存储空间信息成功');
    } catch (error) {
      logger.error(`获取存储空间信息失败: ${error}`);
      console.error("获取存储空间信息失败:", error);
      internalError(res, "获取存储空间信息失败");
    }
  }
}

export default DashboardController;