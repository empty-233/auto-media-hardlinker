import { PrismaClient } from "@prisma/client";

// 将 prisma 客户端的类型定义添加到 Node.js 的全局类型中
declare global {
  var prisma: PrismaClient;
}

// 防止在开发环境中重复创建 PrismaClient 实例
const client = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV === "development") {
  globalThis.prisma = client;
}

export default client;
