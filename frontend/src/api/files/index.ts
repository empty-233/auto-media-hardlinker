import http from '@/utils/http'
import type { FileInfo, FileSystemItem, RenameFileParams, LinkMediaParams } from './types'

/**
 * 目录内容响应接口
 */
export interface DirectoryResponse {
  items: FileSystemItem[]
  currentPath: string
  parentPath: string | null
}

/**
 * 文件API服务
 */
export class FileService {
  /**
   * 获取目录内容
   */
  static async getDirectoryContents(dirPath?: string): Promise<DirectoryResponse> {
    const url = dirPath ? `/files/directory?dirPath=${encodeURIComponent(dirPath)}` : '/files/directory'
    return http.get<DirectoryResponse>(url)
  }

  /**
   * 获取单个文件详情
   */
  static async getFileById(id: number): Promise<FileInfo> {
    return http.get<FileInfo>(`/files/${id}`)
  }

  /**
   * 重命名文件
   */
  static async renameFile(filePath: string, params: RenameFileParams): Promise<{ success: boolean; newPath: string }> {
    return http.post<{ success: boolean; newPath: string }>('/files/rename', {
      filePath,
      ...params
    })
  }

  /**
   * 关联媒体文件
   */
  static async linkMedia(fileId: number | string, params: LinkMediaParams): Promise<FileInfo> {
    return http.post<FileInfo>(`/files/${fileId}/link-media`, params, {}, {
      timeout: 60000 // 60秒超时
    })
  }

  /**
   * 取消关联媒体文件
   */
  static async unlinkMedia(fileId: number): Promise<FileInfo> {
    return http.post<FileInfo>(`/files/${fileId}/unlink-media`)
  }

  /**
   * 更新碟片编号
   */
  static async updateDiscNumber(fileId: number, discNumber: number | null): Promise<FileInfo> {
    return http.patch<FileInfo>(`/files/${fileId}/disc-number`, { discNumber })
  }
}
