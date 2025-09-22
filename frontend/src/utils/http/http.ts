import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiResponse, RequestConfig, ErrorResponse } from './types'

/**
 * HTTP状态码枚举
 */
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503
}

/**
 * 默认配置
 */
const defaultConfig: RequestConfig = {
  baseURL: import.meta.env.DEV ? '/api' : import.meta.env.VITE_API_BASE_URL,
  timeout: Number(import.meta.env.VITE_API_TIMEOUT) || 10000,
  headers: {
    'Content-Type': 'application/json;charset=UTF-8'
  },
  withCredentials: false
}

/**
 * 创建axios实例
 */
class HttpClient {
  private instance: AxiosInstance

  constructor(config: RequestConfig = {}) {
    this.instance = axios.create({
      ...defaultConfig,
      ...config
    })

    this.setupInterceptors()
  }

  /**
   * 设置拦截器
   */
  private setupInterceptors(): void {
    // 请求拦截器
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // 添加认证token
        const token = this.getToken()
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`
        }

        // 添加请求时间戳
        if (config.method === 'get' && config.params) {
          config.params._t = Date.now()
        }

        console.log(`[HTTP Request] ${config.method?.toUpperCase()} ${config.url}`, {
          params: config.params,
          data: config.data
        })

        return config
      },
      (error: AxiosError) => {
        console.error('[HTTP Request Error]', error)
        return Promise.reject(error)
      }
    )

    // 响应拦截器
    this.instance.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        console.log(`[HTTP Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, response.data)

        // 处理JWT自动刷新
        const newToken = response.headers['x-new-token']
        if (newToken) {
          localStorage.setItem('auth_token', newToken)
          console.log('Token自动刷新成功')
        }

        const { data } = response
        
        // 处理业务逻辑错误
        if (!data.success) {
          return Promise.reject(new Error(data.message))
        }

        return response
      },
      (error: AxiosError<ErrorResponse>) => {
        console.error('[HTTP Response Error]', error)
        this.handleHttpError(error)
        return Promise.reject(error)
      }
    )
  }

  /**
   * 获取认证token
   */
  private getToken(): string | null {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
  }

  /**
   * 处理HTTP错误
   */
  private handleHttpError(error: AxiosError<ErrorResponse>): void {
    const { response, message } = error

    if (response) {
      const { status, data } = response
      
      switch (status) {
        case HttpStatus.BAD_REQUEST:
          break
        case HttpStatus.UNAUTHORIZED:
          ElMessage.error('登录已过期，请重新登录')
          // 清除token并跳转到登录页
          this.clearAuth()
          // router.push('/login')
          break
        case HttpStatus.FORBIDDEN:
          ElMessage.error('没有权限访问该资源')
          break
        case HttpStatus.NOT_FOUND:
          ElMessage.error('请求的资源不存在')
          break
        case HttpStatus.INTERNAL_SERVER_ERROR:
          ElMessage.error('服务器内部错误')
          break
        case HttpStatus.BAD_GATEWAY:
          ElMessage.error('网关错误')
          break
        case HttpStatus.SERVICE_UNAVAILABLE:
          ElMessage.error('服务暂不可用')
          break
        default:
          ElMessage.error(data?.message || `请求失败 (${status})`)
      }
    } else if (message.includes('timeout')) {
      ElMessage.error('请求超时，请稍后重试')
    } else if (message.includes('Network Error')) {
      ElMessage.error('网络连接错误，请检查网络')
    } else {
      ElMessage.error('请求失败，请稍后重试')
    }
  }

  /**
   * 清除认证信息
   */
  private clearAuth(): void {
    localStorage.removeItem('auth_token')
    sessionStorage.removeItem('auth_token')
    localStorage.removeItem('userInfo')
  }

  /**
   * GET请求
   */
  public get<T = unknown, P = Record<string, any>>(
    url: string,
    params?: P,
    config?: Partial<Omit<InternalAxiosRequestConfig, 'params'>>
  ): Promise<T> {
    return this.instance.get<ApiResponse<T>>(url, { params, ...config })
      .then(response => response.data.data)
  }

  /**
   * POST请求
   */
  public post<T = unknown, P = Record<string, any>>(
    url: string,
    data?: unknown,
    params?: P,
    config?: Partial<Omit<InternalAxiosRequestConfig, 'params'>>
  ): Promise<T> {
    return this.instance.post<ApiResponse<T>>(url, data, { params, ...config })
      .then(response => response.data.data)
  }

  /**
   * PUT请求
   */
  public put<T = unknown, P = Record<string, any>>(
    url: string,
    data?: unknown,
    params?: P,
    config?: Partial<Omit<InternalAxiosRequestConfig, 'params'>>
  ): Promise<T> {
    return this.instance.put<ApiResponse<T>>(url, data, { params, ...config })
      .then(response => response.data.data)
  }

  /**
   * PATCH请求
   */
  public patch<T = unknown, P = Record<string, any>>(
    url: string,
    data?: unknown,
    params?: P,
    config?: Partial<Omit<InternalAxiosRequestConfig, 'params'>>
  ): Promise<T> {
    return this.instance.patch<ApiResponse<T>>(url, data, { params, ...config })
      .then(response => response.data.data)
  }

  /**
   * DELETE请求
   */
  public delete<T = unknown, P = Record<string, any>>(
    url: string,
    params?: P,
    config?: Partial<Omit<InternalAxiosRequestConfig, 'params'>>
  ): Promise<T> {
    return this.instance.delete<ApiResponse<T>>(url, { params, ...config })
      .then(response => response.data.data)
  }

  /**
   * 上传文件
   */
  public upload<T = unknown, P = Record<string, any>>(
    url: string,
    file: File | FormData,
    params?: P,
    onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void
  ): Promise<T> {
    const formData = file instanceof FormData ? file : new FormData()
    if (file instanceof File) {
      formData.append('file', file)
    }

    return this.instance.post<ApiResponse<T>>(url, formData, {
      params,
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress
    }).then(response => response.data.data)
  }

  /**
   * 下载文件
   */
  public download<P = Record<string, any>>(
    url: string,
    params?: P,
    filename?: string
  ): Promise<void> {
    return this.instance.get(url, {
      params,
      responseType: 'blob'
    }).then(response => {
      const blob = new Blob([response.data])
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename || 'download'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    })
  }

  /**
   * 获取原始axios实例
   */
  public getInstance(): AxiosInstance {
    return this.instance
  }
}

// 创建默认实例
export const http = new HttpClient()

// 导出类供自定义配置使用
export { HttpClient }
export default http