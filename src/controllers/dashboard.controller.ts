import { Response } from "express";
import { success } from "@/utils/response";
import { DashboardService } from "@/services";
import { TypedController, TypedRequest } from "./base.controller";

// 仪表板控制器
export class DashboardController extends TypedController {
  private dashboardService: DashboardService;

  constructor() {
    super();
    this.dashboardService = new DashboardService();
  }

  // 获取仪表板统计数据
  getDashboardStats = this.asyncHandler(
    async (req: TypedRequest, res: Response) => {
      const stats = await this.dashboardService.getDashboardStats();
      success(res, stats, "获取统计数据成功");
    }
  );

  // 获取最近添加的媒体
  getRecentMedia = this.asyncHandler(
    async (req: TypedRequest, res: Response) => {
      const limit = req.query.limit || 10;
      const recentMedia = await this.dashboardService.getRecentMedia(limit);
      success(res, recentMedia, "获取最近媒体成功");
    }
  );

  // 获取存储信息
  getStorageInfo = this.asyncHandler(
    async (req: TypedRequest, res: Response) => {
      const storageInfo = await this.dashboardService.getStorageInfo();
      success(res, storageInfo, "获取存储信息成功");
    }
  );
}
