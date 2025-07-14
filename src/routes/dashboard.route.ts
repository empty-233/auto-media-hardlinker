import { Router } from 'express'
import { DashboardController } from '../controllers'

const router = Router();

router.get('/getDashboardStats', DashboardController.getDashboardStats);
router.get('/getRecentMedia', DashboardController.getRecentMedia);
router.get('/getStorageInfo', DashboardController.getStorageInfo);

export default router