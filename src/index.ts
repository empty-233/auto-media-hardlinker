import { Server } from "http";
import app from "./app";
import prisma from "./client";
import { logger } from "./utils/logger";
import { MediaHardlinkerService } from "./core/mediaHardlinker";
import { env } from "./config/env";

const port = env.PORT;

let server: Server;
const hardlinkerService = new MediaHardlinkerService();

prisma.$connect().then(() => {
  logger.info("Connected to SQL Database");
  // 启动核心服务
  hardlinkerService.start();
  server = app.listen(port, () => {
    logger.info(`Listening to port ${port}`);
  });
});

const exitHandler = () => {
  hardlinkerService.stop().then(() => {
    if (server) {
      server.close(() => {
        logger.info("Server closed");
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });
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
