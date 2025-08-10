import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { logger } from '../utils/logger';
import { badRequest } from '../utils/response';

/**
 * 验证目标类型
 */
export type ValidationType = 'body' | 'params' | 'query';

/**
 * 验证配置接口
 */
export interface ValidationConfig {
  /** 验证的目标：请求体、路径参数或查询参数 */
  target: ValidationType;
  /** Zod验证器 */
  schema: ZodSchema;
  /** 是否可选验证（如果数据不存在时不验证） */
  optional?: boolean;
  /** 自定义错误消息 */
  customMessage?: string;
}

/**
 * 创建验证中间件
 * @param config 验证配置
 * @returns Express中间件函数
 */
export function validateRequest(config: ValidationConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const { target, schema, optional = false } = config;
      
      // 获取要验证的数据
      let dataToValidate: any;
      switch (target) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        default:
          throw new Error(`不支持的验证目标: ${target}`);
      }

      // 如果数据为空且验证是可选的，则跳过验证
      if (optional && (!dataToValidate || Object.keys(dataToValidate).length === 0)) {
        return next();
      }

      // 执行验证
      const validatedData = schema.parse(dataToValidate);

      // 将验证后的数据重新赋值到请求对象
      switch (target) {
        case 'body':
          req.body = validatedData;
          break;
        case 'params':
          Object.defineProperty(req, 'params', {
            value: validatedData,
            writable: true,
          });
          break;
        case 'query':
           Object.defineProperty(req, 'query', {
            value: validatedData,
            writable: true,
          });
          break;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // 处理Zod验证错误
        const errorMessage = formatZodError(error);
        logger.warn(`请求验证失败 [${config.target}]: ${req.method} ${req.path}`);
        
        badRequest(res, config.customMessage || errorMessage);
      } else {
        // 处理其他错误
        logger.error(`验证中间件错误:`, error);
        badRequest(res, '请求验证失败');
      }
    }
  };
}

/**
 * 多重验证中间件 - 同时验证多个目标
 * @param configs 验证配置数组
 * @returns Express中间件函数
 */
export function validateMultiple(...configs: ValidationConfig[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const middlewares = configs.map(config => validateRequest(config));
    
    // 依次执行验证中间件
    const executeNext = (index: number) => {
      if (index >= middlewares.length) {
        return next();
      }
      
      middlewares[index](req, res, (error?: any) => {
        if (error) {
          return next(error);
        }
        executeNext(index + 1);
      });
    };
    
    executeNext(0);
  };
}

/**
 * 格式化Zod验证错误信息
 * @param error ZodError对象
 * @returns 格式化后的错误消息
 */
function formatZodError(error: ZodError): string {
  if (error.issues.length === 1) {
    const issue = error.issues[0];
    const path = issue.path.length > 0 ? `字段 ${issue.path.join('.')} ` : '';
    return `${path}${issue.message}`;
  }

  const errors = error.issues.map(issue => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });

  return `验证失败: ${errors.join('; ')}`;
}

/**
 * 常用验证中间件预定义
 */
export class ValidationMiddleware {
  /**
   * 验证请求体
   */
  static body(schema: ZodSchema, customMessage?: string) {
    return validateRequest({
      target: 'body',
      schema,
      customMessage
    });
  }

  /**
   * 验证路径参数
   */
  static params(schema: ZodSchema, customMessage?: string) {
    return validateRequest({
      target: 'params',
      schema,
      customMessage
    });
  }

  /**
   * 验证查询参数
   */
  static query(schema: ZodSchema, customMessage?: string) {
    return validateRequest({
      target: 'query',
      schema,
      customMessage
    });
  }

  /**
   * 可选验证请求体（如果请求体为空则跳过）
   */
  static optionalBody(schema: ZodSchema, customMessage?: string) {
    return validateRequest({
      target: 'body',
      schema,
      optional: true,
      customMessage
    });
  }

  /**
   * 可选验证查询参数（如果查询参数为空则跳过）
   */
  static optionalQuery(schema: ZodSchema, customMessage?: string) {
    return validateRequest({
      target: 'query',
      schema,
      optional: true,
      customMessage
    });
  }
}

/**
 * 验证器组合工具
 */
export class ValidatorComposer {
  private configs: ValidationConfig[] = [];

  /**
   * 添加请求体验证
   */
  body(schema: ZodSchema, customMessage?: string): ValidatorComposer {
    this.configs.push({
      target: 'body',
      schema,
      customMessage
    });
    return this;
  }

  /**
   * 添加路径参数验证
   */
  params(schema: ZodSchema, customMessage?: string): ValidatorComposer {
    this.configs.push({
      target: 'params',
      schema,
      customMessage
    });
    return this;
  }

  /**
   * 添加查询参数验证
   */
  query(schema: ZodSchema, customMessage?: string): ValidatorComposer {
    this.configs.push({
      target: 'query',
      schema,
      customMessage
    });
    return this;
  }

  /**
   * 添加可选验证
   */
  optional(target: ValidationType, schema: ZodSchema, customMessage?: string): ValidatorComposer {
    this.configs.push({
      target,
      schema,
      optional: true,
      customMessage
    });
    return this;
  }

  /**
   * 构建验证中间件
   */
  build() {
    return validateMultiple(...this.configs);
  }
}
