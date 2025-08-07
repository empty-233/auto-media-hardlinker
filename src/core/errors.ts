/**
 * 自定义错误类，用于表示不可重试的错误
 */
export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableError";
  }
}