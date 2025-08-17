import http from '@/utils/http'
import type {
  LoginRequest,
  RegisterRequest,
  UserInfo,
  InitializationStatus
} from './types'

const BASE_URL = '/auth'

interface AuthResponse {
  token: string
  user: {
    id: number
    username: string
  }
}

export class AuthService {
  // 检查是否需要初始化
  static async checkInitialization(): Promise<InitializationStatus> {
    return http.get<InitializationStatus>(`${BASE_URL}/check-init`)
  }

  // 用户注册
  static async register(data: RegisterRequest): Promise<AuthResponse> {
    return http.post<AuthResponse>(`${BASE_URL}/register`, data)
  }

  // 用户登录
  static async login(data: LoginRequest): Promise<AuthResponse> {
    return http.post<AuthResponse>(`${BASE_URL}/login`, data)
  }

  // 获取当前用户信息
  static async getCurrentUser(): Promise<UserInfo> {
    return http.get<UserInfo>(`${BASE_URL}/me`)
  }

  // 设置认证token
  static setAuthToken(token: string) {
    // 这个方法现在主要用于初始化时设置token
    // 实际的请求会通过拦截器自动添加token
    localStorage.setItem('auth_token', token)
  }

  // 清除认证token
  static clearAuthToken() {
    localStorage.removeItem('auth_token')
  }
}
