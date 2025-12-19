/**
 * 从文件名中初步提取的媒体信息
 */
export interface ExtractedMediaInfo {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
}

/**
 * 媒体识别器返回的标准化媒体数据结构
 */
export interface IdentifiedMedia {
  type: "movie" | "tv" | "collection";
  tmdbId: number;
  title: string;
  originalTitle: string;
  releaseDate: Date | null;
  description: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  // 特定于电视剧的信息
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  episodeDescription?: string | null;
  episodeStillPath?: string | null;
  // 包含从TMDB获取的原始数据，以备将来使用
  rawData: any;
}

/**
 * 媒体识别器（策略）接口
 */
export interface IMediaIdentifier {
  /**
   * 根据文件名或路径识别媒体信息
   * @param fileName - 文件名
   * @param isDirectory - 是否为目录
   * @param fullPath - 文件的完整路径
   * @returns 返回识别到的媒体详细信息，如果无法识别则返回 null
   */
  identify(
    fileName: string,
    isDirectory: boolean,
    fullPath?: string
  ): Promise<IdentifiedMedia | null>;
}

/**
 * 文件物理信息
 */
export interface FileDetails {
  sourcePath: string;
  linkPath: string;
  fileSize: bigint;
  fileHash: string;
  deviceId: bigint;
  inode: bigint;
}

/**
 * 媒体数据仓储接口
 */
export interface IMediaRepository {
  /**
   * 保存识别到的媒体信息和文件记录到数据库
   * @param media - 识别到的媒体信息
   * @param fileDetails - 文件的详细信息
   * @returns 返回创建或更新后的文件记录
   */
  saveMediaAndFile(
    media: IdentifiedMedia,
    fileDetails: FileDetails
  ): Promise<any>;
}