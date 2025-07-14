/**
 * HTTP请求方法类型
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

/**
 * 通用响应接口
 */
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
  success: boolean
  timestamp: number
}

/**
 * 请求配置接口
 */
export interface RequestConfig {
  baseURL?: string
  timeout?: number
  headers?: Record<string, string>
  withCredentials?: boolean
}

/**
 * 请求参数接口
 */
export interface RequestOptions {
  url: string
  method?: HttpMethod
  data?: unknown
  params?: Record<string, unknown>
  headers?: Record<string, string>
  timeout?: number
}

/**
 * 分页请求参数
 */
export interface PaginationParams {
  page: number
  pageSize: number
  [key: string]: unknown
}

/**
 * 分页响应数据
 */
export interface PaginationResponse<T = unknown> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * 错误响应接口
 */
export interface ErrorResponse {
  code: number
  message: string
  details?: string
  path?: string
  timestamp: number
}

/**
 * 上传文件响应
 */
export interface UploadResponse {
  url: string
  filename: string
  size: number
  type: string
}
