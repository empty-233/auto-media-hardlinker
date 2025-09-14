import { Request, Response } from 'express';
import { ScanService } from '../services/scan.service';
import { ScanScheduler } from '../core/scanScheduler';
import { logger } from '../utils/logger';
import { success, internalError, successWithPagination } from '../utils/response';

export class ScanController {
  private scanService: ScanService;

  constructor(scanScheduler: ScanScheduler) {
    this.scanService = new ScanService(scanScheduler);
  }

  // 手动触发扫描
  triggerScan = async (req: Request, res: Response) => {
    try {
      const result = await this.scanService.triggerScan();
      success(res, result, result.message);
    } catch (error) {
      logger.error('触发扫描失败', error);
      internalError(res, '触发扫描失败');
    }
  };

  // 获取扫描状态
  getScanStatus = async (req: Request, res: Response) => {
    try {
      const statusData = await this.scanService.getScanStatus();
      success(res, statusData, '获取扫描状态成功');
    } catch (error) {
      logger.error('获取扫描状态失败', error);
      internalError(res, '获取扫描状态失败');
    }
  };

  // 获取扫描日志
  getScanLogs = async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const sortBy = req.query.sortBy as string || 'scanTime';
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

      // const {page,limit,sortBy,sortOrder} = req.query;

      const result = await this.scanService.getScanLogs(page, limit, sortBy, sortOrder);
      
      successWithPagination(res, {
        items: result.logs,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      }, '获取扫描日志成功');
    } catch (error) {
      logger.error('获取扫描日志失败', error);
      internalError(res, '获取扫描日志失败');
    }
  };

  // 获取库文件列表
  getLibraryFiles = async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as string;
      const status = req.query.status as string;

      const result = await this.scanService.getLibraryFiles(page, limit, type, status);

      successWithPagination(res, {
        items: result.files,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      }, '获取库文件列表成功');
    } catch (error) {
      logger.error('获取库文件列表失败', error);
      internalError(res, '获取库文件列表失败');
    }
  };

  // 删除库文件记录
  deleteLibraryFile = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      await this.scanService.deleteLibraryFile(parseInt(id));

      success(res, null, '删除库文件记录成功');
    } catch (error) {
      logger.error('删除库文件记录失败', error);
      internalError(res, '删除库文件记录失败');
    }
  };

  // 重新处理库文件
  reprocessLibraryFile = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      await this.scanService.reprocessLibraryFile(parseInt(id));

      success(res, null, '重新处理库文件成功');
    } catch (error) {
      logger.error('重新处理库文件失败', error);
      internalError(res, '重新处理库文件失败');
    }
  };

  // 获取扫描配置
  getScanConfig = async (req: Request, res: Response) => {
    try {
      const config = await this.scanService.getScanConfig();
      success(res, config, '获取扫描配置成功');
    } catch (error) {
      logger.error('获取扫描配置失败', error);
      internalError(res, '获取扫描配置失败');
    }
  };

  // 更新扫描配置
  updateScanConfig = async (req: Request, res: Response) => {
    try {
      const config = await this.scanService.updateScanConfig(req.body);
      success(res, config, '更新扫描配置成功');
    } catch (error) {
      logger.error('更新扫描配置失败', error);
      internalError(res, '更新扫描配置失败');
    }
  };
}
