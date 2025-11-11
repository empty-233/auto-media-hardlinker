import path from "path";
import express from "express";
import cors from "cors";
import routers from "./routes";
import { authenticateToken } from "./middleware/auth.middleware";
import { isDevelopment } from "./config/env";

const app = express();

// 设置跨域请求
app.use(cors());

// 解析JSON请求
app.use(express.json());
// 解析urlenced的请求
app.use(express.urlencoded({ extended: true }));

// 处理 BigInt 序列化问题
app.set("json replacer", (key: string, value: any) => {
  // 将 BigInt 转换为字符串
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
});

// 仅在开发环境提供静态文件服务
// 生产环境下由 nginx 直接提供静态文件
if (isDevelopment()) {
  app.use(express.static(path.join(__dirname, "../public")));
}

// JWT验证中间件，但排除不需要认证的路由
app.use("/api", (req, res, next) => {
  // 不需要认证的路由
  const publicRoutes = [
    "/auth/login",
    "/auth/register", 
    "/auth/check-init"
  ];

  // 检查是否为公开路由
  if (publicRoutes.includes(req.path)) {
    return next();
  }

  // 其他路由需要验证JWT
  authenticateToken(req, res, next);
});

app.use("/api", routers);

export default app;
