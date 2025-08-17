import { Request, Response } from "express";
import { DashboardService } from "../services";
import { logger } from "../utils/logger";
import { success, internalError } from "../utils/response";

export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  // 获取仪表板统计信息
  getDashboardStats = async (req: Request, res: Response) => {
    try {
      const dashboardData = await this.dashboardService.getDashboardStats();
      success(res, dashboardData, '获取仪表板统计信息成功');
    } catch (error) {
      logger.error(`获取仪表板统计信息失败`, error);
      internalError(res, "获取仪表板统计信息失败");
    }
  }

  // 获取最近添加的媒体
  getRecentMedia = async (req: Request, res: Response) => {
    try {
      const { limit } = req.query as any;
      const recentMedia = await this.dashboardService.getRecentMedia(limit);
      success(res, recentMedia, '获取最近添加的媒体成功');
    } catch (error) {
      logger.error(`获取最近添加的媒体失败`, error);
      internalError(res, "获取最近添加的媒体失败");
    }
  }

  // 获取存储空间详细信息
  getStorageInfo = async (req: Request, res: Response) => {
    try {
      const storageInfo = await this.dashboardService.getStorageInfo();
      success(res, storageInfo, '获取存储空间信息成功');
    } catch (error) {
      logger.error(`获取存储空间信息失败`, error);
      internalError(res, "获取存储空间信息失败");
    }
  }
}