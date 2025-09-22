import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { ScanController } from '../controllers';
import { ScanScheduler } from '../core/scanScheduler';
import { createValidator } from '../middleware/validation.middleware';
import { ParamValidators, ScanQueryValidators, ScanBodyValidators } from '../validators';

const prisma = new PrismaClient();
const scanScheduler = new ScanScheduler(prisma);
const scanController = new ScanController(scanScheduler);

// 启动扫描调度器
scanScheduler.start();

const router = Router();

// 手动触发扫描
router.post("/trigger", scanController.triggerScan);

// 获取扫描状态
router.get("/status", scanController.getScanStatus);

// 获取扫描日志
router.get(
  "/logs",
  createValidator({
    query: ScanQueryValidators.logs
  }),
  scanController.getScanLogs
);

// 获取库文件列表
router.get(
  "/library",
  createValidator({
    query: ScanQueryValidators.libraryFiles
  }),
  scanController.getLibraryFiles
);

// 删除库文件记录
router.delete(
  '/library/:id', 
  createValidator({
    params: ParamValidators.id
  }), 
  scanController.deleteLibraryFile
);

// 重新处理库文件
router.put(
  '/library/:id/reprocess', 
  createValidator({
    params: ParamValidators.id
  }), 
  scanController.reprocessLibraryFile
);

// 获取扫描配置
router.get("/config", scanController.getScanConfig);

// 更新扫描配置
router.put(
  "/config",
  createValidator({
    body: ScanBodyValidators.updateConfig
  }),
  scanController.updateScanConfig
);

export default router;