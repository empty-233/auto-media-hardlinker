import validate from "express-zod-safe";
import type { CompleteValidationSchema, ErrorRequestHandler } from "express-zod-safe";
import { logger } from "@/utils/logger";
import { badRequest } from "@/utils/response";

/**
 * 创建默认的错误处理器
 */
export const createDefaultErrorHandler = (): ErrorRequestHandler => {
  return (errors, req, res, _next) => {
    // 收集所有验证错误
    const errorMessages: string[] = [];
    
    errors.forEach(({ type, errors: zodErrors }) => {
      zodErrors.issues.forEach(issue => {
        const path = issue.path.length > 0 ? `${issue.path.join('.')}` : type;
        errorMessages.push(`${path}: ${issue.message}`);
      });
    });
    
    const errorMessage = errorMessages.length > 0
      ? `验证失败: ${errorMessages.join('; ')}`
      : '验证失败';
      
    logger.warn(`请求验证失败: ${req.method} ${req.path} - ${errorMessage}`);
    return badRequest(res, errorMessage);
  };
};

/**
 * 创建验证中间件的便捷函数
 */
export const createValidator = (schema: CompleteValidationSchema) => {
  return validate({
    ...schema,
    handler: schema.handler || createDefaultErrorHandler()
  });
};
