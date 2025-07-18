/**
 * 分页响应数据类型
 */
export interface PaginatedResponse<T = any> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * 基础分页查询参数
 */
export interface BasePaginationParams {
  page?: number
  limit?: number
}