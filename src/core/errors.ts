/**
 * 错误类型枚举
 */
export enum ErrorType {
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  FILE_EXISTS = "FILE_EXISTS", 
  MEDIA_LINK_CONFLICT = "MEDIA_LINK_CONFLICT",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NON_RETRYABLE = "NON_RETRYABLE",
  FILE_OPERATION_ERROR = "FILE_OPERATION_ERROR"
}

/**
 * 业务错误类
 */
export class BusinessError extends Error {
  public readonly type: ErrorType;

  constructor(type: ErrorType, message: string) {
    super(message);
    this.type = type;
    this.name = "BusinessError";
  }
}

/**
 * 自定义错误类，用于表示不可重试的错误
 */
export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableError";
  }
}