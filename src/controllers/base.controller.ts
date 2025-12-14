import { Request, Response } from "express";
import { z } from "zod";
import { BusinessError, ErrorType } from "@/core/errors";
import { logger } from "@/utils/logger";
import { badRequest, internalError, notFound } from "@/utils/response";

/**
 * 类型安全的请求接口
 * 利用 express-zod-safe 提供的类型推断
 */
export interface TypedRequest<
  TParams = Record<string, any>,
  TQuery = Record<string, any>,
  TBody = any
> extends Omit<Request, 'params' | 'query' | 'body'> {
  params: TParams;
  query: TQuery;
  body: TBody;
}

/**
 * 类型安全的控制器基类
 * 提供通用的错误处理和响应方法
 */
export abstract class TypedController {
  /**
   * 安全的异步路由处理器包装
   * 自动处理异常并返回适当的错误响应
   */
  protected asyncHandler<TParams = any, TQuery = any, TBody = any>(
    handler: (req: TypedRequest<TParams, TQuery, TBody>, res: Response) => Promise<void>
  ) {
    return async (req: Request, res: Response) => {
      try {
        await handler(req as TypedRequest<TParams, TQuery, TBody>, res);
      } catch (error) {
        this.handleError(error, req, res);
      }
    };
  }

  /**
   * 统一的错误处理方法
   */
  protected handleError(error: unknown, req: Request, res: Response) {
    logger.error(`Controller error in ${req.method} ${req.path}:`, error);

    if (res.headersSent) {
      return;
    }

    if (error instanceof BusinessError) {
      switch (error.type) {
        case ErrorType.MEDIA_LINK_CONFLICT:
        case ErrorType.VALIDATION_ERROR:
        case ErrorType.FILE_EXISTS:
          return badRequest(res, error.message);
        case ErrorType.FILE_NOT_FOUND:
          return notFound(res, error.message);
        case ErrorType.FILE_OPERATION_ERROR:
          return internalError(res, error.message);
        default:
          return internalError(res, error.message || "处理请求时发生未知业务错误");
      }
    } else if (error instanceof Error && error.name === "NonRetryableError") {
      return badRequest(res, error.message);
    } else {
      return internalError(res, "服务器内部错误");
    }
  }
}

/**
 * 从 Zod schema 推断类型的工具类型
 */
export type InferSchemaType<T> = T extends z.ZodType<infer U> ? U : never;