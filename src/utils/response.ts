import { Response } from "express";
import {
  ApiResponse,
  PaginatedResponse,
  ValidationErrorResponse,
  HttpStatus,
  ResponseMessages,
} from "@/types/response.types";

// 响应工具类
export class ResponseUtil {
  /**
   * 成功响应
   * @param res Express Response对象
   * @param data 返回数据
   * @param message 成功消息
   * @param code 状态码，默认200
   */
  static success<T>(
    res: Response,
    data?: T,
    message: string = ResponseMessages.SUCCESS,
    code: number = HttpStatus.OK
  ): void {
    const response: ApiResponse<T> = {
      success: true,
      code,
      message,
      data,
      timestamp: Date.now(),
    };
    res.status(code).json(response);
  }

  /**
   * 分页成功响应
   * @param res Express Response对象
   * @param data 分页数据
   * @param message 成功消息
   * @param code 状态码，默认200
   */
  static successWithPagination<T>(
    res: Response,
    data: PaginatedResponse<T>,
    message: string = ResponseMessages.SUCCESS,
    code: number = HttpStatus.OK
  ): void {
    if (data.totalPages === undefined) {
      data.totalPages = Math.ceil(data.total / data.limit);
    }
    ResponseUtil.success(res, data, message, code);
  }

  /**
   * 错误响应
   * @param res Express Response对象
   * @param message 错误消息
   * @param code 状态码，默认500
   * @param data 错误详情数据
   */
  static error<T>(
    res: Response,
    message: string = ResponseMessages.INTERNAL_ERROR,
    code: number = HttpStatus.INTERNAL_SERVER_ERROR,
    data?: T
  ): void {
    const response: ApiResponse<T> = {
      success: false,
      code,
      message,
      data,
      timestamp: Date.now(),
    };
    res.status(code).json(response);
  }

  /**
   * 参数错误响应
   * @param res Express Response对象
   * @param message 错误消息
   * @param data 错误详情数据
   */
  static badRequest<T>(
    res: Response,
    message: string = ResponseMessages.BAD_REQUEST,
    data?: T
  ): void {
    ResponseUtil.error(res, message, HttpStatus.BAD_REQUEST, data);
  }

  /**
   * 验证错误响应
   * @param res Express Response对象
   * @param errors 验证错误详情
   * @param message 错误消息
   */
  static validationError(
    res: Response,
    errors: ValidationErrorResponse,
    message: string = ResponseMessages.VALIDATION_ERROR
  ): void {
    ResponseUtil.error(res, message, HttpStatus.UNPROCESSABLE_ENTITY, errors);
  }

  /**
   * 未授权响应
   * @param res Express Response对象
   * @param message 错误消息
   */
  static unauthorized(
    res: Response,
    message: string = ResponseMessages.UNAUTHORIZED
  ): void {
    ResponseUtil.error(res, message, HttpStatus.UNAUTHORIZED);
  }

  /**
   * 禁止访问响应
   * @param res Express Response对象
   * @param message 错误消息
   */
  static forbidden(
    res: Response,
    message: string = ResponseMessages.FORBIDDEN
  ): void {
    ResponseUtil.error(res, message, HttpStatus.FORBIDDEN);
  }

  /**
   * 资源未找到响应
   * @param res Express Response对象
   * @param message 错误消息
   */
  static notFound(
    res: Response,
    message: string = ResponseMessages.NOT_FOUND
  ): void {
    ResponseUtil.error(res, message, HttpStatus.NOT_FOUND);
  }

  /**
   * 资源冲突响应
   * @param res Express Response对象
   * @param message 错误消息
   */
  static conflict(
    res: Response,
    message: string = ResponseMessages.CONFLICT
  ): void {
    ResponseUtil.error(res, message, HttpStatus.CONFLICT);
  }

  /**
   * 内部服务器错误响应
   * @param res Express Response对象
   * @param message 错误消息
   * @param data 错误详情数据
   */
  static internalError<T>(
    res: Response,
    message: string = ResponseMessages.INTERNAL_ERROR,
    data?: T
  ): void {
    ResponseUtil.error(res, message, HttpStatus.INTERNAL_SERVER_ERROR, data);
  }

  /**
   * 服务不可用响应
   * @param res Express Response对象
   * @param message 错误消息
   */
  static serviceUnavailable(
    res: Response,
    message: string = ResponseMessages.SERVICE_UNAVAILABLE
  ): void {
    ResponseUtil.error(res, message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

// 导出便捷使用的函数
export const {
  success,
  successWithPagination,
  error,
  badRequest,
  validationError,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  internalError,
  serviceUnavailable,
} = ResponseUtil;
