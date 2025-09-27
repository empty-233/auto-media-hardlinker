import { Response } from "express";
import { success, successWithPagination } from "../utils/response";
import { ScanService } from "../services/scan.service";
import { ScanScheduler } from "../core/fileManage/scanScheduler";
import { TypedController, TypedRequest } from "./base.controller";
import {
  ScanQueryValidators,
  ScanBodyValidators,
  ParamValidators,
} from "../validators";
import { z } from "zod";

// 类型推导
type GetLogsQuery = z.infer<typeof ScanQueryValidators.logs>;
type GetLibraryFilesQuery = z.infer<typeof ScanQueryValidators.libraryFiles>;
type UpdateConfigBody = z.infer<typeof ScanBodyValidators.updateConfig>;
type IdParam = z.infer<typeof ParamValidators.id>;

// 扫描控制器
export class ScanController extends TypedController {
  private scanService: ScanService;

  constructor(scanScheduler: ScanScheduler) {
    super();
    this.scanService = new ScanService(scanScheduler);
  }

  // 手动触发扫描
  triggerScan = this.asyncHandler(async (req: TypedRequest, res: Response) => {
    const result = await this.scanService.triggerScan();
    success(res, result, result.message);
  });

  // 获取扫描状态
  getScanStatus = this.asyncHandler(
    async (req: TypedRequest, res: Response) => {
      const statusData = await this.scanService.getScanStatus();
      success(res, statusData, "获取扫描状态成功");
    }
  );

  // 获取扫描日志
  getScanLogs = this.asyncHandler(
    async (req: TypedRequest<{}, GetLogsQuery>, res: Response) => {
      const { page, limit, sortBy, sortOrder } = req.query;

      const result = await this.scanService.getScanLogs(
        page,
        limit,
        sortBy,
        sortOrder
      );

      successWithPagination(
        res,
        {
          items: result.logs,
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
        "获取扫描日志成功"
      );
    }
  );

  // 获取库文件列表
  getLibraryFiles = this.asyncHandler(
    async (req: TypedRequest<{}, GetLibraryFilesQuery>, res: Response) => {
      const { page, limit, type, status } = req.query;

      const result = await this.scanService.getLibraryFiles(
        page,
        limit,
        type,
        status
      );

      successWithPagination(
        res,
        {
          items: result.files,
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
        "获取库文件列表成功"
      );
    }
  );

  // 删除库文件记录
  deleteLibraryFile = this.asyncHandler(
    async (req: TypedRequest<IdParam>, res: Response) => {
      const { id } = req.params;

      await this.scanService.deleteLibraryFile(id);

      success(res, null, "删除库文件记录成功");
    }
  );

  // 重新处理库文件
  reprocessLibraryFile = this.asyncHandler(
    async (req: TypedRequest<IdParam>, res: Response) => {
      const { id } = req.params;

      await this.scanService.reprocessLibraryFile(id);

      success(res, null, "重新处理库文件成功");
    }
  );

  // 获取扫描配置
  getScanConfig = this.asyncHandler(
    async (req: TypedRequest, res: Response) => {
      const config = await this.scanService.getScanConfig();
      success(res, config, "获取扫描配置成功");
    }
  );

  // 更新扫描配置
  updateScanConfig = this.asyncHandler(
    async (req: TypedRequest<{}, {}, UpdateConfigBody>, res: Response) => {
      const config = await this.scanService.updateScanConfig(req.body);
      success(res, config, "更新扫描配置成功");
    }
  );
}
