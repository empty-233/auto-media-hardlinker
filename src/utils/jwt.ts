import jwt from 'jsonwebtoken'
import { env } from '../config/env'

const JWT_SECRET = env.JWT_SECRET || 'auto-media-hardlinker-secret-key'

export interface JwtPayload {
  userId: number
  username: string
}

export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '3d' })
}

export const verifyToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    throw new Error('Invalid or expired token')
  }
}

export const verifyAndRefreshToken = (token: string): { payload: JwtPayload; newToken?: string } => {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload & { exp: number; iat: number }
    
    // 计算token剩余时间（秒）
    const now = Math.floor(Date.now() / 1000)
    const timeUntilExpiry = payload.exp - now
    
    // 如果token在1天内过期，生成新token
    const shouldRefresh = timeUntilExpiry < 24 * 60 * 60 // 1天 = 24*60*60秒
    
    if (shouldRefresh) {
      const newToken = generateToken({
        userId: payload.userId,
        username: payload.username
      })
      return { payload, newToken }
    }
    
    return { payload }
  } catch {
    throw new Error('Invalid or expired token')
  }
}

export const decodeToken = (token: string): JwtPayload | null => {
  try {
    return jwt.decode(token) as JwtPayload
  } catch {
    return null
  }
}
