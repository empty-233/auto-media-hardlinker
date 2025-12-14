/**
 * @fileoverview 依赖注入容器
 * @description 管理应用程序中的依赖关系，避免单例模式的问题
 */

import { PrismaClient } from '@/generated/client';
import client from '@/client';
import { FileProcessor } from './fileProcessor';
import { SpecialFolderProcessor } from './specialFolderProcessor';
import { MediaRepository } from '@/repository/media.repository';

/**
 * 依赖注入容器接口
 */
export interface Container {
  getPrismaClient(): PrismaClient;
  getMediaRepository(): MediaRepository;
  getFileProcessor(): FileProcessor;
  getSpecialFolderProcessor(): SpecialFolderProcessor;
  dispose(): Promise<void>;
}

/**
 * 依赖注入容器实现
 */
class DIContainer implements Container {
  private prismaClient: PrismaClient | null = null;
  private mediaRepository: MediaRepository | null = null;
  private fileProcessor: FileProcessor | null = null;
  private specialFolderProcessor: SpecialFolderProcessor | null = null;

  /**
   * 获取 PrismaClient 实例
   */
  getPrismaClient(): PrismaClient {
    if (!this.prismaClient) {
      this.prismaClient = client;
    }
    return this.prismaClient;
  }

  /**
   * 获取 MediaRepository 实例
   */
  getMediaRepository(): MediaRepository {
    if (!this.mediaRepository) {
      this.mediaRepository = new MediaRepository();
    }
    return this.mediaRepository;
  }

  /**
   * 获取 FileProcessor 实例
   */
  getFileProcessor(): FileProcessor {
    if (!this.fileProcessor) {
      this.fileProcessor = new FileProcessor(this.getPrismaClient());
    }
    return this.fileProcessor;
  }

  /**
   * 获取 SpecialFolderProcessor 实例
   */
  getSpecialFolderProcessor(): SpecialFolderProcessor {
    if (!this.specialFolderProcessor) {
      this.specialFolderProcessor = new SpecialFolderProcessor(
        this.getPrismaClient(),
        this.getFileProcessor()
      );
    }
    return this.specialFolderProcessor;
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    this.prismaClient = null;
    
    this.mediaRepository = null;
    this.fileProcessor = null;
    this.specialFolderProcessor = null;
  }
}

// 全局容器实例
let containerInstance: DIContainer | null = null;

/**
 * 获取容器实例
 */
export function getContainer(): Container {
  if (!containerInstance) {
    containerInstance = new DIContainer();
  }
  return containerInstance;
}

/**
 * 重置容器实例
 */
export async function resetContainer(): Promise<void> {
  if (containerInstance) {
    await containerInstance.dispose();
    containerInstance = null;
  }
}