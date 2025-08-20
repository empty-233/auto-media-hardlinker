import { z } from 'zod';
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// 检查 .env 文件是否存在
const checkEnvFile = () => {
  const currentDir = process.cwd();
  const envPath = resolve(currentDir, '.env');
  const envExamplePath = resolve(currentDir, '.env.example');
  
  console.log(`检查 .env 文件: ${envPath}`);
  
  if (!existsSync(envPath)) {
    console.warn('警告: 未找到 .env 文件');
    
    if (existsSync(envExamplePath)) {
      console.warn('提示: 发现 .env.example 文件，请复制并重命名为 .env');
      console.warn(`执行命令: cp ${envExamplePath} ${envPath}`);
    } else {
      console.warn('提示: 请创建 .env 文件来配置环境变量');
    }
    
    console.warn('应用将使用默认配置继续运行\n');
  } else {
    console.log('找到 .env 文件');
  }
};

// 检查 .env 文件
checkEnvFile();

// 加载环境变量
dotenv.config({ path: resolve(process.cwd(), '.env') });

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
  
  // 控制台输出开关 (生产环境默认关闭，开发环境默认开启)
  CONSOLE_OUTPUT: z
    .string()
    .default(process.env.NODE_ENV === NodeEnv.PRODUCTION ? "false" : "true")
    .transform((value) => value.toLowerCase() === "true"),

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
