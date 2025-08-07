import { Router } from "express";
import dashboardRoutes from "./dashboard.route";
import mediaRoutes from "./media.routes";
import fileRoutes from "./file.routes";
import episodeRoutes from "./episode.routes";
import systemRoutes from "./system.routes";
import tmdbRoutes from "./tmdb.routes";
import queueRoutes from "./queue.routes";

const router = Router();

// 挂载各个路由
router.use("/dashboard", dashboardRoutes);
router.use("/media", mediaRoutes);
router.use("/files", fileRoutes);
router.use("/episodes", episodeRoutes);
router.use("/tmdb", tmdbRoutes);
router.use("/queue", queueRoutes);
router.use("/", systemRoutes);

export default router;
