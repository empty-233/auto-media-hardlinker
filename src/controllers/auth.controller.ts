import { Request, Response } from "express";
import { AuthService } from "../services";
import { logger } from "../utils/logger";
import {
  success,
  badRequest,
  unauthorized,
  internalError,
  forbidden,
  notFound,
} from "../utils/response";

export class AuthController {
  constructor(private authService: AuthService) {}

  // 用户登录
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return badRequest(res, "用户名和密码不能为空");
      }

      const result = await this.authService.login({ username, password });
      success(res, result, "登录成功");
    } catch (error: any) {
      logger.error("登录失败:", error);
      if (error.message === "用户名或密码错误") {
        // 密码错误应该返回400而不是401，避免被前端认证拦截器误处理
        badRequest(res, error.message);
      } else {
        internalError(res, "服务器错误");
      }
    }
  };

  // 用户注册（仅在没有用户时允许）
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return badRequest(res, "用户名和密码不能为空");
      }

      const result = await this.authService.register({ username, password });
      success(res, result, "用户注册成功", 201);
    } catch (error: any) {
      logger.error("注册失败:", error);
      if (error.message === "密码长度不能少于6位") {
        badRequest(res, error.message);
      } else if (error.message === "系统已有用户，无法注册新用户") {
        forbidden(res, error.message);
      } else {
        internalError(res, "服务器错误");
      }
    }
  };

  // 获取当前用户信息
  getCurrentUser = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        return unauthorized(res, "未授权");
      }

      const user = await this.authService.getCurrentUser(req.user.userId);
      success(res, user, "获取用户信息成功");
    } catch (error: any) {
      logger.error("获取用户信息失败:", error);
      if (error.message === "用户不存在") {
        notFound(res, error.message);
      } else {
        internalError(res, "服务器错误");
      }
    }
  };

  // 检查是否需要初始化用户
  checkInitialization = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.authService.checkInitialization();
      success(res, result, "检查初始化状态成功");
    } catch (error) {
      logger.error("检查初始化状态失败:", error);
      internalError(res, "服务器错误");
    }
  };
}
