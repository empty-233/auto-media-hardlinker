import { Server } from "http";
import app from "./app";
import prisma from "./client";
import { logger } from "./utils/logger";
import { MediaHardlinkerService } from "./core/fileManage/mediaHardlinker";
import { env } from "./config/env";

const port = env.PORT;

let server: Server;
const hardlinkerService = new MediaHardlinkerService();

prisma.$connect()
  .then(async () => {
    logger.info("Connected to SQL Database");
    
    // 启动核心服务
    await hardlinkerService.start();
    
    // 启动 HTTP 服务器
    server = app.listen(port, () => {
      logger.info(`Listening to port ${port}`);
    });
    
    server.on('error', (error: NodeJS.ErrnoException) => {
      logger.error(`HTTP 服务器错误: ${error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用` : error.message}`);
      process.exit(1);
    });
  })
  .catch((error) => {
    logger.error("应用启动失败", error);
    process.exit(1);
  });

const exitHandler = () => {
  logger.info("正在关闭服务...");
  
  hardlinkerService.stop()
    .then(() => {
      if (server) {
        server.close(() => {
          prisma.$disconnect().finally(() => process.exit(0));
        });
      } else {
        prisma.$disconnect().finally(() => process.exit(0));
      }
    })
    .catch(() => process.exit(1));
};

const unexpectedErrorHandler = (error: unknown) => {
  logger.error("未捕获的异常或未处理的拒绝", error);
  exitHandler();
};

process.on("uncaughtException", unexpectedErrorHandler);
process.on("unhandledRejection", unexpectedErrorHandler);

process.on("SIGTERM", () => {
  logger.info("SIGTERM received");
  if (server) {
    server.close();
  }
});
