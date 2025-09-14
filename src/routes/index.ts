import { Router } from "express";
import authRoutes from "./auth.routes";
import dashboardRoutes from "./dashboard.routes";
import mediaRoutes from "./media.routes";
import fileRoutes from "./file.routes";
import episodeRoutes from "./episode.routes";
import systemRoutes from "./system.routes";
import tmdbRoutes from "./tmdb.routes";
import queueRoutes from "./queue.routes";
import scanRoutes from "./scan.routes";

const router = Router();

// 挂载各个路由
router.use("/auth", authRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/media", mediaRoutes);
router.use("/files", fileRoutes);
router.use("/episodes", episodeRoutes);
router.use("/tmdb", tmdbRoutes);
router.use("/queue", queueRoutes);
router.use("/scan", scanRoutes);
router.use("/", systemRoutes);

export default router;
