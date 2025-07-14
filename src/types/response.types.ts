// 通用响应格式类型定义
export interface ApiResponse<T = any> {
  success: boolean;
  code: number;
  message: string;
  data?: T;
  timestamp: number;
}

// 分页响应数据类型
export interface PaginatedResponse<T = any> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 错误详情类型
export interface ErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

// 验证错误响应类型
export interface ValidationErrorResponse {
  errors: ErrorDetail[];
}

// 常用HTTP状态码
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503
}

// 常用响应消息
export const ResponseMessages = {
  SUCCESS: '操作成功',
  CREATED: '创建成功',
  UPDATED: '更新成功',
  DELETED: '删除成功',
  BAD_REQUEST: '请求参数错误',
  UNAUTHORIZED: '未授权访问',
  FORBIDDEN: '禁止访问',
  NOT_FOUND: '资源不存在',
  CONFLICT: '资源冲突',
  VALIDATION_ERROR: '数据验证失败',
  INTERNAL_ERROR: '内部服务器错误',
  SERVICE_UNAVAILABLE: '服务不可用'
} as const;
