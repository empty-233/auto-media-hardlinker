import { Request, Response, NextFunction } from 'express'
import { verifyToken, JwtPayload } from '@/utils/jwt'
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { logger } from '@/utils/logger';
import { unauthorized, internalError } from '@/utils/response';

// 扩展 Request 接口以包含用户信息
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // 明确是客户端错误，返回 401
      unauthorized(res, '未提供或格式错误的访问令牌');
      return;
    }

    const token = authHeader.split(' ')[1]

    const decoded = verifyToken(token);
    req.user = decoded;
    next();

  } catch (error) {
    // 更精细的错误处理
    if (error instanceof TokenExpiredError) {
      unauthorized(res, '访问令牌已过期');
    } else if (error instanceof JsonWebTokenError) {
      unauthorized(res, '无效的访问令牌');
    } else {
      logger.error('身份验证中间件出错:', error);
      internalError(res, '服务器内部错误');
    }
  }
};