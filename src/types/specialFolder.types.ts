/**
 * 特殊文件夹类型枚举
 */
export enum SpecialFolderType {
  BDMV = 'BDMV',
  DVD_VIDEO = 'VIDEO_TS',
  ISO = 'ISO',
  NORMAL = 'NORMAL'
}

/**
 * 特殊文件夹信息
 */
export interface SpecialFolder {
  path: string;
  type: SpecialFolderType;
  name: string;
  originalName: string;
  totalSize: number;
  fileCount: number;
  isMultiDisc: boolean;
  discNumber: number | null;
  contentType: 'main' | 'sp' | 'bonus' | 'menu' | 'pv' | 'ova' | 'other';
  year: number | null;
  tmdbId?: number | null;
  standardizedName?: string | null;
}

/**
 * 媒体信息（从 TMDB 刮削获取）
 */
export interface MediaInfo {
  tmdbId: number;
  standardizedName: string;
  mediaType: 'movie' | 'tv' | 'collection';
  title: string;
  originalTitle: string | null;
  releaseDate: string | null;
  description: string | null;
  posterPath: string | null;
}

/**
 * 特殊文件夹处理结果
 */
export interface SpecialFolderProcessResult {
  folderInfo: SpecialFolder;
  linkPath: string;
  mediaInfo: MediaInfo;
}

/**
 * 文件夹详细信息（用于数据库保存）
 */
export interface FolderDetails {
  sourcePath: string;
  linkPath: string;
  deviceId: bigint;
  inode: bigint;
  fileHash: string;
  fileSize: bigint;
  folderType: string;
  isMultiDisc: boolean;
  discNumber: number | null;
}
