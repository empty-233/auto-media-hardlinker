import http from '@/utils/http'
import type { FileInfo } from './types'

/**
 * 文件API服务
 */
export class FileService {
  /**
   * 获取所有文件列表
   */
  static async getAllFiles(): Promise<FileInfo[]> {
    return http.get<FileInfo[]>('/files')
  }

  /**
   * 获取单个文件详情
   */
  static async getFileById(id: number): Promise<FileInfo> {
    return http.get<FileInfo>(`/files/${id}`)
  }
}
