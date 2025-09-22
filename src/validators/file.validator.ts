import { z } from 'zod';
import { CommonValidators } from './common.validator';

/**
 * 媒体信息验证（用于关联媒体）
 * 
 * 这个验证器用于验证从前端传来的媒体信息数据结构，
 * 通常在文件关联媒体时使用。使用 z.coerce 自动处理类型转换，
 * 并使用 .catch(null) 为日期转换失败提供容错处理。
 */
const mediaInfoSchema = z.object({
  /** 媒体类型：电影或电视剧 */
  type: CommonValidators.mediaType,
  /** TMDB数据库ID，自动转换字符串为数字 */
  tmdbId: z.coerce.number().int().positive('TMDB ID必须是正整数'),
  /** 媒体标题 */
  title: CommonValidators.title,
  /** 原始标题（通常是英文标题） */
  originalTitle: CommonValidators.title,
  /** 发布日期，自动转换为Date对象，失败时返回null */
  releaseDate: z.coerce.date().nullable().catch(null),
  /** 媒体描述/简介 */
  description: CommonValidators.description,
  /** 海报图片路径，TMDB返回的相对路径如"/abc.jpg"或完整URL */
  posterPath: CommonValidators.imagePath,
  /** 背景图片路径，TMDB返回的相对路径如"/def.jpg"或完整URL */
  backdropPath: CommonValidators.imagePath,
  /** 原始数据，保存从TMDB获取的完整数据 */
  rawData: z.any()
});

/**
 * 文件相关的验证器
 * 
 * 包含所有文件操作相关的验证规则，如重命名、关联媒体等。
 * 这些验证器主要用于文件管理API的请求验证。
 */
export const FileValidators = {
  /**
   * 重命名文件请求体验证
   * 
   * 验证文件重命名操作的参数。确保提供了有效的文件路径和新文件名，
   * 新文件名不能包含路径分隔符以防止路径遍历攻击。
   * 
   * @example
   * // 请求体示例
   * {
   *   "filePath": "/anime/[Group] Series - 01.mp4",
   *   "newName": "[Group] Series - Episode 01 [1080p].mp4"
   * }
   */
  renameFile: z.object({
    /** 文件的完整路径 */
    filePath: CommonValidators.filePath,
    /** 新文件名，不能包含路径分隔符 */
    newName: CommonValidators.fileName.refine(
      (name) => !name.includes('/') && !name.includes('\\'),
      '文件名不能包含路径分隔符'
    )
  }),

  /**
   * 媒体信息验证（用于关联媒体）
   * 
   * 导出给其他模块使用的媒体信息验证器。
   * 包含完整的媒体元数据结构验证。
   */
  mediaInfo: mediaInfoSchema,

  /**
   * 关联媒体请求体验证
   * 
   * 验证文件与媒体库关联的参数。支持电影和电视剧两种类型，
   * 电视剧类型需要额外的季集信息和剧集TMDB ID。
   * 使用 z.coerce 自动处理数字类型转换。
   * 
   * @example
   * // 电影关联示例
   * {
   *   "mediaInfo": {
   *     "type": "movie",
   *     "tmdbId": "550",
   *     "title": "搏击俱乐部"
   *   },
   *   "filename": "Fight.Club.1999.1080p.mp4",
   *   "path": "/movies/"
   * }
   * 
   * // 电视剧关联示例
   * {
   *   "mediaInfo": {
   *     "type": "tv",
   *     "tmdbId": "1399",
   *     "title": "权力的游戏"
   *   },
   *   "filename": "Game.of.Thrones.S01E01.1080p.mp4",
   *   "path": "/tv/",
   *   "seasonNumber": "1",
   *   "episodeNumber": "1",
   *   "episodeTmdbId": "63056"
   * }
   */
  linkMedia: z.object({
    /** 媒体信息对象，包含TMDB数据 */
    mediaInfo: mediaInfoSchema,
    /** 文件名 */
    filename: CommonValidators.fileName,
    /** 文件路径，可以为空(代表根目录) */
    path: CommonValidators.optionalFilePath.default(''),
    /** 剧集的TMDB ID（仅电视剧需要），自动转换为数字 */
    episodeTmdbId: z.coerce.number().int().positive().optional().default(0),
    /** 季号（仅电视剧需要），自动转换为数字，允许从第0季开始 */
    seasonNumber: z.coerce.number().int().min(0).nullable().optional().default(0),
    /** 集号（仅电视剧需要），自动转换为数字，允许从第0集开始 */
    episodeNumber: z.coerce.number().int().min(0).nullable().optional().default(0)
  }).refine(
    (data) => {
      // 如果是电视剧类型，必须提供季集信息
      if (data.mediaInfo.type === 'tv') {
        return data.seasonNumber !== null && data.episodeNumber !== null && data.episodeTmdbId;
      }
      return true;
    },
    {
      message: '电视剧类型必须提供季号、集号和剧集TMDB ID',
      path: ['seasonNumber', 'episodeNumber', 'episodeTmdbId']
    }
  ),

  /**
   * 获取目录内容查询参数验证
   * 
   * 验证目录浏览请求的参数，确保目录路径有效且长度合理。
   * dirPath 可以为空，空值代表监听文件夹的根目录。
   * 
   * @example
   * // 查询参数示例
   * ?dirPath=/anime/2024/
   * ?dirPath=  (空值，代表根目录)
   */
  getDirectoryContents: z.object({
    /** 目录路径，可以为空(代表根目录)，长度限制在1024字符内 */
    dirPath: CommonValidators.optionalFilePath
  })
};

/**
 * 文件相关的路径参数验证器
 * 
 * 用于验证URL路径中的参数，如文件ID等。
 * 这些验证器通常在Express路由的参数验证中使用。
 */
export const FileParamValidators = {
  /**
   * 文件ID路径参数验证
   * 
   * 验证URL路径中的文件ID参数，确保是有效的数字ID。
   * 
   * @example
   * // 路由: /api/files/:id
   * // URL: /api/files/123
   * // params: { id: "123" }
   */
  fileId: z.object({
    /** 文件ID，必须是有效的正整数 */
    id: CommonValidators.id
  })
};

/**
 * 支持的媒体文件扩展名
 * 
 * 定义系统支持的所有媒体文件格式。这个列表用于文件类型验证，
 * 确保只有支持的格式才能被处理。包含了主流的视频容器格式。
 */
const supportedExtensions = [
  '.mp4',   // MP4容器格式
  '.mkv',   // Matroska容器格式
  '.avi',   // AVI容器格式
  '.mov',   // QuickTime格式
  '.wmv',   // Windows Media Video
  '.flv',   // Flash Video
  '.webm',  // WebM格式
  '.m4v',   // iTunes视频格式
  '.mpg',   // MPEG-1/2格式
  '.mpeg',  // MPEG格式
  '.3gp',   // 3GPP格式
  '.ogv',   // Ogg Video
  '.ts',    // MPEG Transport Stream
  '.m2ts',  // MPEG-2 Transport Stream
  '.mts'    // AVCHD格式
];

/**
 * 预定义的文件验证规则
 * 
 * 提供常用的文件验证功能，包括格式检查、大小限制等。
 * 这些验证规则可以在其他验证器中复用。
 */
export const FileValidationRules = {
  /**
   * 支持的媒体文件扩展名列表
   * 
   * 导出给其他模块使用的扩展名列表。
   */
  supportedExtensions,

  /**
   * 验证是否为支持的媒体文件
   * 
   * 通过文件扩展名判断是否为系统支持的媒体格式。
   * 验证是大小写不敏感的。
   * 
   * @example
   * // 有效的文件名
   * "movie.mp4" ✓
   * "series.MKV" ✓
   * "video.avi" ✓
   * 
   * // 无效的文件名
   * "document.pdf" ✗
   * "image.jpg" ✗
   * "file.txt" ✗
   */
  isSupportedMediaFile: z.string().refine(
    (filename: string): boolean => {
      const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      return supportedExtensions.includes(ext);
    },
    '不支持的媒体文件格式'
  ),

  /**
   * 验证文件大小（字节）
   * 
   * 创建一个文件大小验证器，限制文件大小不超过指定的MB数。
   * 返回一个可以复用的Zod验证器。
   * 
   * @param maxSizeInMB - 最大文件大小（MB）
   * @returns Zod数字验证器
   * 
   * @example
   * // 限制文件大小不超过100MB
   * const sizeValidator = FileValidationRules.validateFileSize(100);
   * 
   * // 在schema中使用
   * z.object({
   *   fileSize: sizeValidator
   * })
   */
  validateFileSize: (maxSizeInMB: number) => z.number().max(
    maxSizeInMB * 1024 * 1024,
    `文件大小不能超过${maxSizeInMB}MB`
  )
};
