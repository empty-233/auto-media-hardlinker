import { z } from 'zod';

/**
 * 认证请求体验证器
 * 
 * 用于验证用户认证相关的请求体数据，如登录、注册、密码重置等。
 * 包含用户账户管理和安全相关的验证规则。
 */
export const AuthBodyValidators = {
  /**
   * 用户注册请求体验证
   * 验证用户注册时的必要字段和格式
   * 
   * @example
   * {
   *   username: "johndoe",
   *   password: "securePassword123",
   *   email: "john@example.com"
   * }
   */
  register: z.object({
    /** 用户名，必填 */
    username: z.string().trim().min(3, '用户名至少3个字符').max(20, '用户名最多20个字符')
      .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符'),
    /** 密码，必填 */
    password: z.string().min(6, '密码至少6个字符').max(50, '密码最多50个字符')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, '密码必须包含至少一个大写字母、一个小写字母和一个数字'),
  }),

  /**
   * 用户登录请求体验证
   * 验证用户登录时的凭据格式
   * 
   * @example
   * {
   *   username: "johndoe",
   *   password: "securePassword123",
   *   rememberMe: true
   * }
   */
  login: z.object({
    /** 用户名或邮箱，必填 */
    username: z.string().trim().min(1, '用户名不能为空'),
    /** 密码，必填 */
    password: z.string().min(1, '密码不能为空'),
  }),
};