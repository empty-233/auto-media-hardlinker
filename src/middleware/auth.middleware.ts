import { Request, Response, NextFunction } from 'express'
import { verifyAndRefreshToken, JwtPayload } from '../utils/jwt'
import { logger } from '../utils/logger'
import { unauthorized, forbidden } from '../utils/response'

// 扩展Request接口以包含用户信息
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    unauthorized(res, '访问令牌缺失')
    return
  }

  try {
    const { payload, newToken } = verifyAndRefreshToken(token)
    req.user = payload
    
    // 如果生成了新token，在响应头中返回
    if (newToken) {
      res.setHeader('X-New-Token', newToken)
      logger.info(`刷新Token: ${payload.username}`)
    }
    
    next()
  } catch (error) {
    logger.error('Token验证失败: ', error)
    forbidden(res, '无效或过期的访问令牌')
    return
  }
}

// 可选的认证中间件，如果有token则验证，没有也不报错
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return next()
  }

  try {
    const { payload, newToken } = verifyAndRefreshToken(token)
    req.user = payload
    
    // 如果生成了新token，在响应头中返回
    if (newToken) {
      res.setHeader('X-New-Token', newToken)
    }
  } catch (error) {
    logger.warn(`可选Token验证失败: ${error}`)
  }

  next()
}
