import http from "@/utils/http";
import type { PaginatedResponse } from "@/types/api";
import type {
  QueueStats,
  QueueStatus,
  QueueConfig,
  ScrapingTask,
  TaskQueryParams,
} from "./types";

/**
 * 队列API服务
 */
export class QueueService {
  /**
   * 获取队列统计信息
   */
  static async getStats(): Promise<QueueStats> {
    return http.get<QueueStats>("/queue/stats");
  }

  /**
   * 获取队列服务状态
   */
  static async getStatus(): Promise<QueueStatus> {
    return http.get<QueueStatus>("/queue/status");
  }

  /**
   * 获取队列配置
   */
  static async getConfig(): Promise<QueueConfig> {
    return http.get<QueueConfig>("/queue/config");
  }

  /**
   * 更新队列配置
   */
  static async updateConfig(
    config: Partial<QueueConfig>
  ): Promise<QueueConfig> {
    return http.put<QueueConfig>("/queue/config", config);
  }

  /**
   * 获取任务列表
   */
  static async getTasks(params?: TaskQueryParams): Promise<PaginatedResponse<ScrapingTask>> {
    return http.get<PaginatedResponse<ScrapingTask>>("/queue/tasks", params);
  }

  /**
   * 重试指定任务
   */
  static async retryTask(taskId: number): Promise<void> {
    return http.post<void>(`/queue/tasks/${taskId}/retry`);
  }

  /**
   * 取消指定任务
   */
  static async cancelTask(taskId: number): Promise<void> {
    return http.delete<void>(`/queue/tasks/${taskId}`);
  }

  /**
   * 重试所有失败的任务
   */
  static async retryAllFailedTasks(): Promise<{ retryCount: number }> {
    return http.post<{ retryCount: number }>("/queue/tasks/retry-all-failed");
  }

  /**
   * 清除所有失败的任务
   */
  static async clearFailedTasks(): Promise<{ clearCount: number }> {
    return http.delete<{ clearCount: number }>("/queue/tasks/failed");
  }
}

export * from "./types";
