import { PrismaClient } from '@/generated/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { isDevelopment } from "./config/env";

// 将 prisma 客户端的类型定义添加到 Node.js 的全局类型中
declare global {
  var prisma: PrismaClient;
}

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL
})

// 防止在开发环境中重复创建 PrismaClient 实例
const client = globalThis.prisma || new PrismaClient({adapter});
if (isDevelopment()) {
  globalThis.prisma = client;
}

export default client;
