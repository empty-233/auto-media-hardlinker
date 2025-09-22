import { Response } from "express";
import {
  success,
  successWithPagination,
} from "../utils/response";
import { SystemService } from "../services";
import { TypedController, TypedRequest } from "./base.controller";
import {
  SystemBodyValidators,
  SystemQueryValidators,
} from "../validators";
import { z } from "zod";

// 类型推导
type UpdateConfigBody = z.infer<typeof SystemBodyValidators.updateConfig>;
type GetLogsQuery = z.infer<typeof SystemQueryValidators.logs>;

// 系统控制器
export class SystemController extends TypedController {
  constructor(private systemService: SystemService) {
    super();
  }

  // 获取系统日志
  getLogs = this.asyncHandler(async (req: TypedRequest<{}, GetLogsQuery>, res: Response) => {
    const { page, limit, level ,keyword,sortBy,sortOrder} = req.query;
    
    const logs = this.systemService.getLogs(
      page,
      limit,
      level,
      keyword,
      sortBy,
      sortOrder
    );
    
    successWithPagination(res, logs, "获取系统日志成功");
  });

  // 获取系统配置
  getConfig = this.asyncHandler(async (req: TypedRequest, res: Response) => {
    const config = this.systemService.getConfig();
    success(res, config, "获取系统配置成功");
  });

  // 更新系统配置
  updateConfig = this.asyncHandler(async (req: TypedRequest<{}, {}, UpdateConfigBody>, res: Response) => {
    const updatedConfig = this.systemService.updateConfig(req.body);
    success(res, updatedConfig, "更新系统配置成功");
  });
}