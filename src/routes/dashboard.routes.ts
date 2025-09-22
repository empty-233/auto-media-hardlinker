import { Router } from 'express'
import { DashboardController } from '../controllers';
import { createValidator } from '../middleware/validation.middleware';
import { DashboardQueryValidators } from '../validators';

const dashboardController = new DashboardController();

const router = Router();

router.get('/getDashboardStats', dashboardController.getDashboardStats);
router.get(
  '/getRecentMedia',
  createValidator({ query: DashboardQueryValidators.recentActivity }),
  dashboardController.getRecentMedia
);
router.get('/getStorageInfo', dashboardController.getStorageInfo);

export default router;