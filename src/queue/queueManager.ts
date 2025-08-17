import prisma from "../client";
import { logger } from "../utils/logger";
import {
  ScrapingTaskData,
  QueueStats,
  TaskQueryOptions,
  IQueueManager,
  TaskResult,
  QueueConfig,
} from "../types/queue.types";
import { TaskStatus, Queue } from "@prisma/client";

/**
 * 队列管理器 - 负责任务的入队、出队和状态管理
 */
export class QueueManager implements IQueueManager {
  private config: QueueConfig;

  constructor(config: QueueConfig) {
    this.config = config;
  }
  
  /**
   * 将任务加入队列
   */
  async enqueue(taskData: ScrapingTaskData): Promise<number> {
    try {
      const task = await prisma.queue.create({
        data: {
          filePath: taskData.filePath,
          fileName: taskData.fileName,
          isDirectory: taskData.isDirectory,
          priority: taskData.priority || 0,
          maxRetries: taskData.maxRetries || this.config.defaultMaxRetries,
          status: TaskStatus.PENDING,
        },
      });

      logger.info(`任务已加入队列: ${taskData.fileName} (ID: ${task.id})`);
      return task.id;
    } catch (error) {
      logger.error(`任务入队失败: ${taskData.fileName}`, error);
      throw error;
    }
  }

  /**
   * 批量将任务加入队列
   */
  async enqueueTasks(tasksData: ScrapingTaskData[]): Promise<number[]> {
    if (tasksData.length === 0) {
      return [];
    }

    try {
      const allTaskIds: number[] = [];
      const batchSize = this.config.batchSize;

      // 分批处理任务以避免单次操作过大
      for (let i = 0; i < tasksData.length; i += batchSize) {
        const batch = tasksData.slice(i, i + batchSize);
        
        // 使用事务确保数据一致性
        const batchTaskIds = await prisma.$transaction(async (tx) => {
          // 创建任务
          await tx.queue.createMany({
            data: batch.map((taskData) => ({
              filePath: taskData.filePath,
              fileName: taskData.fileName,
              isDirectory: taskData.isDirectory,
              priority: taskData.priority || 0,
              maxRetries: taskData.maxRetries || this.config.defaultMaxRetries,
              status: TaskStatus.PENDING,
            })),
          });

          // 获取刚创建的任务ID列表
          const createdTasks = await tx.queue.findMany({
            select: { id: true },
            where: {
              AND: [
                { filePath: { in: batch.map((t) => t.filePath) } },
                { status: TaskStatus.PENDING },
                { startedAt: null }, // 新创建的任务不会有 startedAt
              ]
            },
            orderBy: { id: "desc" },
            take: batch.length,
          });

          return createdTasks.map((task) => task.id);
        });

        allTaskIds.push(...batchTaskIds);
      }

      logger.info(`批量任务已加入队列: ${allTaskIds.length} 个任务`);
      return allTaskIds;
    } catch (error) {
      logger.error(`批量任务入队失败`, error);
      throw error;
    }
  }

  /**
   * 从队列中取出下一个待处理的任务
   */
  async dequeue(): Promise<Queue | null> {
    try {
      return await prisma.$transaction(async (tx) => {
        // 首先查找待处理的任务
        let task = await tx.queue.findFirst({
          where: { status: TaskStatus.PENDING },
          orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        });

        // 如果没有待处理任务，查找可重试的失败任务
        if (!task) {
          task = await tx.queue.findFirst({
            where: {
              status: TaskStatus.FAILED,
              nextRetryAt: { lte: new Date() },
            },
            orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
          });

          // 检查重试次数
          if (task && task.retryCount >= task.maxRetries) {
            task = null;
          }
        }

        if (!task) {
          return null;
        }

        // 将任务状态更新为运行中
        const updatedTask = await tx.queue.update({
          where: { id: task.id },
          data: {
            status: TaskStatus.RUNNING,
            startedAt: new Date(),
            retryCount:
              task.status === TaskStatus.FAILED
                ? { increment: 1 }
                : task.retryCount, // PENDING 任务保持原有重试计数
          },
        });

        return updatedTask;
      });
    } catch (error) {
      logger.error("任务出队失败", error);
      throw error;
    }
  }

  /**
   * 更新任务状态为完成
   */
  async completeTask(taskId: number, result: TaskResult): Promise<void> {
    try {
      await prisma.queue.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
          result: JSON.stringify(result),
          lastError: null,
        },
      });

      logger.info(`任务完成: ID ${taskId}`);
    } catch (error) {
      logger.error(`更新任务完成状态失败: ID ${taskId}`, error);
      throw error;
    }
  }

  /**
   * 更新任务状态为失败
   */
  async failTask(taskId: number, error: string): Promise<void> {
    try {
      const task = await prisma.queue.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        logger.error(`任务不存在: ID ${taskId}`);
        return;
      }

      const isMaxRetriesReached = task.retryCount >= task.maxRetries - 1;
      const nextRetryAt = isMaxRetriesReached
        ? null
        : this.calculateNextRetryTime(task.retryCount + 1);

      await prisma.queue.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.FAILED,
          lastError: error,
          nextRetryAt,
          completedAt: isMaxRetriesReached ? new Date() : null,
        },
      });

      logger.warn(
        `任务失败: ID ${taskId}, 重试次数: ${task.retryCount + 1}/${
          task.maxRetries
        }`
      );
    } catch (updateError) {
      logger.error(`更新任务失败状态失败: ID ${taskId}`, updateError);
      throw updateError;
    }
  }

  /**
   * 将任务标记为永久失败，不再重试
   */
  async failTaskPermanently(taskId: number, error: string): Promise<void> {
    try {
      await prisma.queue.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.FAILED,
          lastError: error,
          nextRetryAt: null, // 不再安排重试
          completedAt: new Date(), // 标记为已完成（虽然是失败）
        },
      });

      logger.warn(`任务已永久失败: ID ${taskId}`);
    } catch (updateError) {
      logger.error(`更新任务永久失败状态失败: ID ${taskId}`, updateError);
      throw updateError;
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: QueueConfig): void {
    this.config = newConfig;
  }

  /**
   * 计算下次重试时间（指数退避策略）
   */
  private calculateNextRetryTime(retryCount: number): Date {
    const baseDelay = this.config.retryDelay; // 使用配置中的基础延迟
    const maxDelay = this.config.maxRetryDelay; // 使用配置中的最大延迟
    const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), maxDelay);
    return new Date(Date.now() + delay);
  }

  /**
   * 获取队列统计信息
   */
  async getStats(): Promise<QueueStats> {
    try {
      const [pending, running, completed, failed, canceled] = await Promise.all(
        [
          prisma.queue.count({ where: { status: TaskStatus.PENDING } }),
          prisma.queue.count({ where: { status: TaskStatus.RUNNING } }),
          prisma.queue.count({ where: { status: TaskStatus.COMPLETED } }),
          prisma.queue.count({ where: { status: TaskStatus.FAILED } }),
          prisma.queue.count({ where: { status: TaskStatus.CANCELED } }),
        ]
      );

      const total = pending + running + completed + failed + canceled;

      // 计算平均处理时间
      const completedTasks = await prisma.queue.findMany({
        where: {
          status: TaskStatus.COMPLETED,
          startedAt: { not: null },
          completedAt: { not: null },
        },
        select: { startedAt: true, completedAt: true },
        take: 100, // 只取最近100个任务来计算平均时间
      });

      let averageProcessingTime: number | undefined;
      if (completedTasks.length > 0) {
        const totalTime = completedTasks.reduce((sum: number, task: any) => {
          if (task.startedAt && task.completedAt) {
            return (
              sum + (task.completedAt.getTime() - task.startedAt.getTime())
            );
          }
          return sum;
        }, 0);
        averageProcessingTime = totalTime / completedTasks.length;
      }

      return {
        pending,
        running,
        completed,
        failed,
        canceled,
        total,
        averageProcessingTime,
      };
    } catch (error) {
      logger.error("获取队列统计失败", error);
      throw error;
    }
  }

  /**
   * 获取任务列表
   */
  async getTasks(options: TaskQueryOptions = {}): Promise<{
    items: Queue[];
    total: number;
  }> {
    try {
      const {
        status,
        limit = 50,
        offset = 0,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      const where = status ? { status: status as TaskStatus } : {};

      const [items, total] = await prisma.$transaction([
        prisma.queue.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          take: limit,
          skip: offset,
        }),
        prisma.queue.count({ where }),
      ]);

      return { items, total };
    } catch (error) {
      logger.error("获取任务列表失败", error);
      throw error;
    }
  }

  /**
   * 重试指定任务
   */
  async retryTask(taskId: number): Promise<boolean> {
    try {
      const task = await prisma.queue.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        logger.error(`任务不存在: ID ${taskId}`);
        return false;
      }

      if (task.status !== TaskStatus.FAILED) {
        logger.error(
          `只能重试失败的任务: ID ${taskId}, 当前状态: ${task.status}`
        );
        return false;
      }

      await prisma.queue.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.PENDING,
          retryCount: 0,
          lastError: null,
          nextRetryAt: null,
          completedAt: null,
        },
      });

      logger.info(`任务已重新加入队列: ID ${taskId}`);
      return true;
    } catch (error) {
      logger.error(`重试任务失败: ID ${taskId}`, error);
      return false;
    }
  }

  /**
   * 取消指定任务
   */
  async cancelTask(taskId: number): Promise<boolean> {
    try {
      const task = await prisma.queue.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        logger.error(`任务不存在: ID ${taskId}`);
        return false;
      }

      if (task.status === TaskStatus.RUNNING) {
        logger.error(`无法取消正在运行的任务: ID ${taskId}`);
        return false;
      }

      if (task.status === TaskStatus.COMPLETED) {
        logger.error(`无法取消已完成的任务: ID ${taskId}`);
        return false;
      }

      if (task.status === TaskStatus.CANCELED) {
        logger.info(`任务已经被取消: ID ${taskId}`);
        return true;
      }

      await prisma.queue.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.CANCELED,
          completedAt: new Date(),
          lastError: "任务被用户取消",
          updatedAt: new Date(),
        },
      });

      logger.info(`任务已取消: ID ${taskId}`);
      return true;
    } catch (error) {
      logger.error(`取消任务失败: ID ${taskId}`, error);
      return false;
    }
  }

  /**
   * 批量重试所有失败的任务
   */
  async retryAllFailedTasks(): Promise<number> {
    try {
      const result = await prisma.queue.updateMany({
        where: { status: TaskStatus.FAILED },
        data: {
          status: TaskStatus.PENDING,
          retryCount: 0,
          lastError: null,
          nextRetryAt: null,
          updatedAt: new Date(),
        },
      });

      logger.info(`已将 ${result.count} 个失败任务重新加入队列`);
      return result.count;
    } catch (error) {
      logger.error("批量重试失败任务失败", error);
      throw error;
    }
  }

  /**
   * 清除所有失败的任务
   */
  async clearFailedTasks(): Promise<number> {
    try {
      const result = await prisma.queue.deleteMany({
        where: { status: TaskStatus.FAILED },
      });

      logger.info(`已清除 ${result.count} 个失败任务`);
      return result.count;
    } catch (error) {
      logger.error("清除失败任务失败", error);
      throw error;
    }
  }

  /**
   * 清理超时的运行中任务
   */
  async cleanupTimeoutTasks(timeoutMs?: number): Promise<number> {
    try {
      const actualTimeout = timeoutMs ?? this.config.processingTimeout;
      const timeoutDate = new Date(Date.now() - actualTimeout);

      const result = await prisma.queue.updateMany({
        where: {
          status: TaskStatus.RUNNING,
          startedAt: { lt: timeoutDate },
        },
        data: {
          status: TaskStatus.FAILED,
          lastError: "任务处理超时",
          completedAt: new Date(),
        },
      });

      if (result.count > 0) {
        logger.warn(`清理了 ${result.count} 个超时任务`);
      }

      return result.count;
    } catch (error) {
      logger.error("清理超时任务失败", error);
      throw error;
    }
  }
}
