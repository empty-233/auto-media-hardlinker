import { Response } from "express";
import {
  success,
  badRequest,
  unauthorized,
} from "../utils/response";
import { AuthService } from "../services/auth.service";
import { TypedController, TypedRequest } from "./base.controller";
import { AuthBodyValidators } from "../validators";
import { z } from "zod";

// 类型推导
type RegisterBody = z.infer<typeof AuthBodyValidators.register>;
type LoginBody = z.infer<typeof AuthBodyValidators.login>;

// 认证控制器
export class AuthController extends TypedController {
  constructor(private authService: AuthService) {
    super();
  }

  // 用户注册
  register = this.asyncHandler(async (req: TypedRequest<{}, {}, RegisterBody>, res: Response) => {
    try {
      const result = await this.authService.register(req.body);
      success(res, result, "注册成功");
    } catch (error) {
      if (error instanceof Error) {
        badRequest(res, error.message);
      } else {
        badRequest(res, "发生未知错误");
      }
    }
  });

  // 用户登录
  login = this.asyncHandler(async (req: TypedRequest<{}, {}, LoginBody>, res: Response) => {
    try {
      const result = await this.authService.login(req.body);
      success(res, result, "登录成功");
    } catch (error) {
      if (error instanceof Error) {
        unauthorized(res, error.message);
      } else {
        unauthorized(res, "发生未知错误");
      }
    }
  });

  // 获取当前用户信息
  getCurrentUser = this.asyncHandler(async (req: TypedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return unauthorized(res, "用户未认证");
    }

    try {
      const user = await this.authService.getCurrentUser(userId);
      success(res, user, "获取用户信息成功");
    } catch (error) {
      if (error instanceof Error) {
        unauthorized(res, error.message);
      } else {
        unauthorized(res, "发生未知错误");
      }
    }
  });

  // 检查初始化状态
  checkInitialization = this.asyncHandler(async (req: TypedRequest, res: Response) => {
    const status = await this.authService.checkInitialization();
    success(res, status, "获取初始化状态成功");
  });

  // 用户登出（仅返回成功信息）
  logout = this.asyncHandler(async (req: TypedRequest, res: Response) => {
    success(res, null, "退出登录成功");
  });
}