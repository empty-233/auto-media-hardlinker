import { z } from 'zod';

/**
 * 通用验证规则
 * 
 * 这个模块包含了项目中最常用的验证规则，所有验证器都可以复用这些基础规则。
 * 使用 z.coerce 来简化类型转换，提高代码可读性和维护性。
 */
export const CommonValidators = {
  /**
   * 数字ID验证 - 必须是正整数
   * 自动将字符串转换为数字，常用于路径参数验证
   * 
   * @example
   * // 路径参数 "/api/files/123" 中的 "123" 会被自动转换为数字 123
   * id: CommonValidators.id
   */
  id: z.coerce.number().int().positive('必须是正整数'),

  /**
   * 可选的数字ID验证
   * 当ID可能不存在时使用，如可选的查询参数
   * 
   * @example
   * // 查询参数 "?parentId=456" 中的 "456" 会被转换为数字，如果不存在则为 undefined
   * parentId: CommonValidators.optionalId
   */
  optionalId: z.coerce.number().int().positive('必须是正整数').optional(),

  /**
   * TMDB ID验证
   * The Movie Database API 的资源ID，必须是正整数
   * 
   * @example
   * // TMDB电影ID: 12345
   * tmdbId: CommonValidators.tmdbId
   */
  tmdbId: z.coerce.number().int().positive('TMDB ID必须是正整数'),

  /**
   * 年份验证
   * 限制在合理的年份范围内（1900年到当前年份+10年）
   * 
   * @example
   * // 电影上映年份: 2024
   * releaseYear: CommonValidators.year
   */
  year: z.coerce.number().int().min(1900, '年份不能早于1900年').max(new Date().getFullYear() + 10, '年份不能超过当前年份10年').optional(),

  /**
   * 季号验证 - 允许从0开始（特殊季，如番外篇）
   * 用于电视剧的季度编号
   * 
   * @example
   * // 第1季: seasonNumber = 1
   * // 特别篇: seasonNumber = 0
   * seasonNumber: CommonValidators.seasonNumber
   */
  seasonNumber: z.coerce.number().int().min(0, '季号不能小于0').max(999, '季号不能超过999').nullable(),

  /**
   * 集号验证 - 允许从0开始（预告片等）
   * 用于电视剧的集数编号
   * 
   * @example
   * // 第1集: episodeNumber = 1
   * // 预告片: episodeNumber = 0
   * episodeNumber: CommonValidators.episodeNumber
   */
  episodeNumber: z.coerce.number().int().min(0, '集号不能小于0').max(9999, '集号不能超过9999').nullable(),

  /**
   * 正常季号验证 - 必须大于等于1
   * 用于正常的电视剧季度，不包括特殊季
   * 提取的通用验证逻辑，避免在多个验证器中重复
   */
  validSeasonNumber: z.coerce.number().int().min(1, '季号必须是大于等于1的整数'),

  /**
   * 正常集号验证 - 必须大于等于1  
   * 用于正常的电视剧集数，不包括特殊集
   * 提取的通用验证逻辑，避免在多个验证器中重复
   */
  validEpisodeNumber: z.coerce.number().int().min(1, '集号必须是大于等于1的整数'),

  /**
   * 文件路径验证
   * 验证文件系统路径的合法性和长度限制
   * 
   * @example
   * // Windows路径: "C:\\Users\\username\\video.mp4"
   * // Linux路径: "/home/username/video.mp4"
   * filePath: CommonValidators.filePath
   */
  filePath: z.string().min(1, '文件路径不能为空').max(512, '文件路径不能超过512个字符'),

  /**
   * 文件名验证
   * 验证文件名的合法性，不包含路径分隔符
   * 
   * @example
   * // 合法文件名: "movie.mp4", "episode_01.mkv"
   * // 非法文件名: "../movie.mp4", "folder/movie.mp4"
   * fileName: CommonValidators.fileName
   */
  fileName: z.string().min(1, '文件名不能为空').max(255, '文件名不能超过255个字符'),

  /**
   * 媒体类型验证
   * 限制为支持的媒体类型：电影(movie)或电视剧(tv)
   * 
   * @example
   * // 电影: type = "movie"
   * // 电视剧: type = "tv"
   * type: CommonValidators.mediaType
   */
  mediaType: z.enum(['movie', 'tv'], {
    message: '媒体类型必须是movie或tv'
  }),

  /**
   * 日期字符串验证
   * 支持ISO 8601格式和简单日期格式
   * 
   * @example
   * // ISO 8601: "2024-08-01T12:00:00Z"
   * // 简单格式: "2024-08-01"
   * dateString: CommonValidators.dateString
   */
  dateString: z.string().datetime('日期格式必须是ISO 8601格式').or(z.string().date('日期格式必须是YYYY-MM-DD格式')).optional(),

  /**
   * URL验证
   * 验证URL格式的合法性，允许为空值
   * 
   * @example
   * // 合法URL: "https://example.com/image.jpg"
   * // 空值: null
   * url: CommonValidators.url
   */
  url: z.string().url('必须是有效的URL').nullable(),

  /**
   * 图片路径验证
   * 验证图片路径，支持TMDB相对路径（如"/abc.jpg"）或完整URL
   * 
   * @example
   * // TMDB相对路径: "/image.jpg"
   * // 完整URL: "https://example.com/image.jpg"
   * // 空值: null
   * imagePath: CommonValidators.imagePath
   */
  imagePath: z.string().nullable(),

  /**
   * 标题验证
   * 验证标题长度和非空性
   * 
   * @example
   * // 电影标题: "阿凡达：水之道"
   * // 剧集标题: "权力的游戏 第一季"
   * title: CommonValidators.title
   */
  title: z.string().min(1, '标题不能为空').max(500, '标题不能超过500个字符'),

  /**
   * 描述验证
   * 验证描述文本长度，允许为空值
   * 
   * @example
   * // 电影简介: "一部关于..."
   * // 空描述: null
   * description: CommonValidators.description
   */
  description: z.string().max(5000, '描述不能超过5000个字符').nullable(),

  /**
   * 分页参数验证
   * 自动转换字符串参数为数字，并提供合理的默认值
   * 
   * @example
   * // 查询参数: "?page=2&limit=50"
   * // 转换后: { page: 2, limit: 50 }
   * // 默认值: { page: 1, limit: 20 }
   * pagination: CommonValidators.pagination
   */
  pagination: z.object({
    page: z.coerce.number().int().min(1, 'page必须是大于0的整数').default(1),
    limit: z.coerce.number().int().min(1, 'limit必须是大于0的整数').max(100, 'limit不能超过100').default(20)
  }),

  /**
   * 布尔值验证
   * 自动转换字符串 "true"/"false" 为布尔值
   * 
   * @example
   * // 查询参数: "?include_adult=true"
   * // 转换后: include_adult = true
   * boolean: CommonValidators.boolean
   */
  boolean: z.coerce.boolean(),

  /**
   * 搜索关键词验证
   * 验证搜索查询的长度和非空性
   * 
   * @example
   * // 搜索电影: "阿凡达"
   * // 搜索电视剧: "权力的游戏"
   * searchQuery: CommonValidators.searchQuery
   */
  searchQuery: z.string().min(1, '搜索关键词不能为空').max(100, '搜索关键词不能超过100个字符'),

  /**
   * 语言代码验证
   * 验证ISO语言代码格式，默认为中文简体
   * 
   * @example
   * // 中文简体: "zh-CN"
   * // 英文: "en-US"
   * // 日文: "ja-JP"
   * languageCode: CommonValidators.languageCode
   */
  languageCode: z.string().min(2, '语言代码不能少于2个字符').max(5, '语言代码不能超过5个字符').default('zh-CN')
};

/**
 * 参数验证辅助函数
 * 
 * 用于验证路径参数的常用模式，避免在每个路由中重复定义相同的验证逻辑。
 * 这些验证器通常用于 Express 路由的 req.params 验证。
 */
export const ParamValidators = {
  /**
   * 验证路径参数中的ID
   * 
   * @example
   * // 路由: "/api/files/:id"
   * // 验证: { id: "123" } -> { id: 123 }
   * router.get("/:id", ValidationMiddleware.params(ParamValidators.id), ...)
   */
  id: z.object({
    id: CommonValidators.id
  }),

  /**
   * 验证可选的路径参数ID
   * 当路径参数可能不存在时使用
   * 
   * @example
   * // 路由: "/api/files/:id?"
   * // 验证: 可能存在也可能不存在的ID参数
   * router.get("/:id?", ValidationMiddleware.params(ParamValidators.optionalId), ...)
   */
  optionalId: z.object({
    id: CommonValidators.optionalId
  })
};

/**
 * 查询参数验证辅助函数
 * 
 * 用于验证URL查询参数的常用模式，提供可复用的查询参数验证逻辑。
 * 这些验证器通常用于 Express 路由的 req.query 验证。
 */
export const QueryValidators = {
  /**
   * 分页查询参数
   * 
   * @example
   * // 查询: "?page=2&limit=50"
   * // 验证和转换: { page: 2, limit: 50 }
   * // 默认值: { page: 1, limit: 20 }
   * router.get("/", ValidationMiddleware.query(QueryValidators.pagination), ...)
   */
  pagination: CommonValidators.pagination,

  /**
   * 目录路径查询参数
   * dirPath 是可选的，不传、传空字符串或传"/"都默认为监控根目录
   * 
   * @example
   * // 查询: "?dirPath=anime/2024"     -> 访问 monitorPath/anime/2024
   * // 查询: "?dirPath=/anime/2024"    -> 访问 monitorPath/anime/2024 (自动移除开头斜杠)
   * // 查询: "?dirPath="               -> 访问 monitorPath (根目录)
   * // 查询: ""                        -> 访问 monitorPath (根目录)
   * router.get("/directory", ValidationMiddleware.query(QueryValidators.directoryPath), ...)
   */
  directoryPath: z.object({
    dirPath: z.string().min(1, '目录路径不能为空').optional()
  })
};
