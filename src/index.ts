import { Server } from "http";
import app from "./app";
import prisma from "./client";
import { logger } from "./utils/logger";

import "./core/mediaHardlinker";

const port = process.env.PORT || 3000;

let server: Server;
prisma.$connect().then(() => {
  logger.info("Connected to SQL Database");
  server = app.listen(port, () => {
    logger.info(`Listening to port ${port}`);
  });
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info("Server closed");
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error: unknown) => {
  logger.error(String(error));
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
