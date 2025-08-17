import { Router } from 'express'
import { DashboardController } from '../controllers';
import { DashboardService } from '../services';

const dashboardService = new DashboardService();
const dashboardController = new DashboardController(dashboardService);

const router = Router();

router.get('/getDashboardStats', dashboardController.getDashboardStats);
router.get('/getRecentMedia', dashboardController.getRecentMedia);
router.get('/getStorageInfo', dashboardController.getStorageInfo);

export default router;