import express from "express";
import { PrismaClient, Type } from "@prisma/client";
import { getConfig } from "./config";
import "./mediaHardlinker";
import path from "path";
import fs from "fs";
// 导出LLM刮削模块
export { RetrieveLLMInfo } from "./LLMmediaData";
import cors from "cors";
import { logger } from "./logger";

const app = express();
const port = 4000;
const prisma = new PrismaClient();

// 处理 BigInt 序列化问题
// 重写 Express 的 JSON 序列化方法，使其支持 BigInt
app.use(express.json());
app.set("json replacer", (key: string, value: any) => {
  // 将 BigInt 转换为字符串
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
});

// 中间件
app.use(cors());
app.use(express.static(path.join(__dirname, "../public")));

// API 路由

// 获取所有媒体列表
app.get("/api/media", async (req, res) => {
  try {
    const media = await prisma.media.findMany({
      include: {
        files: true,
        tvInfos: {
          include: {
            episodes: true,
          },
        },
        movieInfo: true,
        collectionInfo: true,
      },
    });
    logger.info(`获取媒体列表成功，共${media.length}条记录`);
    res.json(media);
  } catch (error) {
    logger.error(`获取媒体列表失败: ${error}`);
    console.error("获取媒体列表失败:", error);
    res.status(500).json({ error: "获取媒体列表失败" });
  }
});

// 获取单个媒体详情
app.get("/api/media/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const media = await prisma.media.findUnique({
      where: { id: parseInt(id) },
      include: {
        files: true,
        tvInfos: {
          include: {
            episodes: true,
          },
        },
        movieInfo: true,
        collectionInfo: true,
      },
    });

    if (!media) {
      logger.warning(`查询ID为${id}的媒体不存在`);
      res.status(404).json({ error: "媒体不存在" });
    }

    logger.info(`获取ID为${id}的媒体详情成功`);
    res.json(media);
  } catch (error) {
    logger.error(`获取媒体${id}详情失败: ${error}`);
    console.error(`获取媒体${id}详情失败:`, error);
    res.status(500).json({ error: "获取媒体详情失败" });
  }
});

// 获取所有文件
app.get("/api/files", async (req, res) => {
  try {
    const files = await prisma.file.findMany({
      include: {
        Media: true,
        episode: true,
      },
    });
    logger.info(`获取文件列表成功，共${files.length}个文件`);
    res.json(files);
  } catch (error) {
    logger.error(`获取文件列表失败: ${error}`);
    console.error("获取文件列表失败:", error);
    res.status(500).json({ error: "获取文件列表失败" });
  }
});

// 获取单个文件详情
app.get("/api/files/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const file = await prisma.file.findUnique({
      where: { id: parseInt(id) },
      include: {
        Media: true,
        episode: true,
      },
    });

    if (!file) {
      logger.warning(`查询ID为${id}的文件不存在`);
      res.status(404).json({ error: "文件不存在" });
    }

    logger.info(`获取ID为${id}的文件详情成功`);
    res.json(file);
  } catch (error) {
    logger.error(`获取文件${id}详情失败: ${error}`);
    console.error(`获取文件${id}详情失败:`, error);
    res.status(500).json({ error: "获取文件详情失败" });
  }
});

// 更新剧集信息
app.put("/api/episodes/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, episodeNumber } = req.body;

  try {
    // 验证请求数据
    if (episodeNumber && isNaN(parseInt(episodeNumber))) {
      res.status(400).json({ error: "剧集编号必须是数字" });
    }

    const updatedEpisode = await prisma.episodeInfo.update({
      where: { id: parseInt(id) },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(episodeNumber !== undefined
          ? { episodeNumber: parseInt(episodeNumber) }
          : {}),
      },
    });

    logger.info(`更新ID为${id}的剧集信息成功`);
    res.json(updatedEpisode);
  } catch (error) {
    logger.error(`更新剧集${id}信息失败: ${error}`);
    console.error(`更新剧集${id}信息失败:`, error);
    res.status(500).json({ error: "更新剧集信息失败" });
  }
});

// 按类型获取媒体
app.get("/api/media/type/:type", async (req, res) => {
  const { type } = req.params;
  try {
    if (!Object.values(Type).includes(type as Type)) {
      logger.warning(`请求了无效的媒体类型: ${type}`);
      res.status(400).json({ error: "无效的媒体类型" });
    }

    const media = await prisma.media.findMany({
      where: { type: type as Type },
      include: {
        files: true,
        tvInfos:
          type === "tv"
            ? {
                include: {
                  episodes: true,
                },
              }
            : undefined,
        movieInfo: type === "movie" ? true : undefined,
        collectionInfo: type === "collection" ? true : undefined,
      },
    });

    logger.info(`获取${type}类型媒体列表成功，共${media.length}条记录`);
    res.json(media);
  } catch (error) {
    logger.error(`获取${type}类型媒体失败: ${error}`);
    console.error(`获取${type}类型媒体失败:`, error);
    res.status(500).json({ error: "获取媒体列表失败" });
  }
});

// 更新剧集信息
app.put("/api/episodes/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, episodeNumber } = req.body;

  try {
    // 验证请求数据
    if (episodeNumber && isNaN(parseInt(episodeNumber.toString()))) {
      res.status(400).json({ error: "剧集编号必须是数字" });
    }

    const updatedEpisode = await prisma.episodeInfo.update({
      where: { id: parseInt(id) },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(episodeNumber !== undefined
          ? { episodeNumber: parseInt(episodeNumber.toString()) }
          : {}),
      },
    });

    logger.info(`更新ID为${id}的剧集信息成功`);
    res.json(updatedEpisode);
  } catch (error) {
    logger.error(`更新剧集${id}信息失败: ${error}`);
    console.error(`更新剧集${id}信息失败:`, error);
    res.status(500).json({ error: "更新剧集信息失败" });
  }
});

// 获取系统日志
app.get("/api/logs", (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
  const logs = logger.getLogs(limit);
  res.json(logs);
});

// 获取系统配置
app.get("/api/config", (req, res) => {
  try {
    const config = getConfig(false); // 不使用缓存，确保获取最新配置
    // 仅返回前端需要的配置信息
    const clientConfig = {
      useLlm: config.useLlm || false,
      llmHost: config.llmHost || "http://localhost:11434",
      llmModel: config.llmModel || "qwen2.5",
    };
    logger.info("获取系统配置成功");
    res.json(clientConfig);
  } catch (error) {
    logger.error(`获取系统配置失败: ${error}`);
    console.error("获取系统配置失败:", error);
    res.status(500).json({ error: "获取系统配置失败" });
  }
});

// 更新系统配置
app.put("/api/config", (req, res) => {
  try {
    const { useLlm } = req.body;

    // 读取现有配置
    const configPath = path.join(process.cwd(), "config/config.json");
    const existingConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

    // 更新配置
    existingConfig.useLlm = useLlm;

    // 写入配置文件
    fs.writeFileSync(
      configPath,
      JSON.stringify(existingConfig, null, 4),
      "utf-8"
    );

    // 刷新配置缓存
    const updatedConfig = getConfig(false);

    logger.info(`更新系统配置成功: useLlm=${useLlm}`);
    res.json({
      useLlm: updatedConfig.useLlm || false,
      llmHost: updatedConfig.llmHost || "http://localhost:11434",
      llmModel: updatedConfig.llmModel || "qwen2.5",
    });
  } catch (error) {
    logger.error(`更新系统配置失败: ${error}`);
    console.error("更新系统配置失败:", error);
    res.status(500).json({ error: "更新系统配置失败" });
  }
});

console.log("Starting server...");
logger.info("系统启动");

// 启动服务器
app.listen(port, () => {
  logger.info(`服务器运行在 http://localhost:${port}`);
  console.log(`服务器运行在 http://localhost:${port}`);
});

export { app };

// 更新剧集信息
app.put("/api/episodes/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, episodeNumber } = req.body;

  try {
    // 验证请求数据
    if (episodeNumber && isNaN(parseInt(String(episodeNumber)))) {
      res.status(400).json({ error: "剧集编号必须是数字" });
    }

    const updatedEpisode = await prisma.episodeInfo.update({
      where: { id: parseInt(id) },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(episodeNumber !== undefined
          ? { episodeNumber: parseInt(String(episodeNumber)) }
          : {}),
      },
    });

    logger.info(`更新ID为${id}的剧集信息成功`);
    res.json(updatedEpisode);
  } catch (error) {
    logger.error(`更新剧集${id}信息失败: ${error}`);
    console.error(`更新剧集${id}信息失败:`, error);
    res.status(500).json({ error: "更新剧集信息失败" });
  }
});
