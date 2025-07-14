import path from "path";
import express from "express";
import cors from "cors";
import routers from "./routes";

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

app.use(express.static(path.join(__dirname, "../public")));

app.use("/api", routers);

export default app;
