import { z } from 'zod';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 定义日志级别枚举
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

// 定义Node环境枚举
export enum NodeEnv {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

// 定义环境变量的zod schema
const envSchema = z.object({
  // 数据库配置
  DATABASE_URL: z.string().default('file:./dev.db'),
  
  // 服务器配置
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(NodeEnv).default(NodeEnv.DEVELOPMENT),
  
  // 图片URL配置
  IMAGE_BASE_URL: z.url().default('http://localhost:3000'),
  
  // 日志配置
  LOG_LEVEL: z.enum(LogLevel).default(LogLevel.INFO),

  // JWT配置
  JWT_SECRET: z.string().default('auto-media-hardlinker-secret-key'),
  JWT_EXPIRES_IN: z.string().default('3d'),

  // 可选配置项
  API_TIMEOUT: z.coerce.number().positive().optional().default(10000),
});

// 解析和验证环境变量
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ 环境变量验证失败:');
      error.issues.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

// 导出验证后的环境变量
export const env = parseEnv();

// 导出类型定义
export type Env = z.infer<typeof envSchema>;

// 辅助函数：检查是否为开发环境
export const isDevelopment = () => env.NODE_ENV === NodeEnv.DEVELOPMENT;

// 辅助函数：检查是否为生产环境
export const isProduction = () => env.NODE_ENV === NodeEnv.PRODUCTION;

// 辅助函数：检查是否为测试环境
export const isTest = () => env.NODE_ENV === NodeEnv.TEST;
