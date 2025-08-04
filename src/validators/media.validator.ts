import { z } from 'zod';
import { CommonValidators } from './common.validator';

/**
 * 媒体相关的验证器
 * 
 * 包含所有媒体管理相关的验证规则，如创建媒体、更新媒体、搜索等。
 * 这些验证器主要用于媒体库管理API的请求验证，支持电影和电视剧两种类型。
 * 使用 z.coerce 进行自动类型转换，简化前端数据处理。
 */
export const MediaValidators = {
  /**
   * 媒体搜索请求验证
   * 
   * 验证媒体搜索API的查询参数。支持按关键词、类型、年份等条件搜索，
   * 并提供分页功能。使用 z.coerce 自动转换数字类型。
   * 
   * @example
   * // 搜索示例
   * {
   *   "query": "复仇者联盟",
   *   "type": "movie",
   *   "year": "2019",
   *   "page": "1"
   * }
   */
  searchMedia: z.object({
    /** 搜索关键词，必须是有效的搜索字符串 */
    query: CommonValidators.searchQuery,
    /** 媒体类型，可选，不指定则搜索所有类型 */
    type: CommonValidators.mediaType.optional(),
    /** 发布年份，可选，用于精确匹配 */
    year: CommonValidators.year.optional(),
    /** 页码，自动转换为数字，默认第1页，最大500页 */
    page: z.coerce.number().int().min(1).max(500).default(1)
  }),

  /**
   * 获取媒体详情验证
   * 
   * 验证获取单个媒体详细信息的请求参数。
   * 需要指定TMDB ID和媒体类型来准确定位媒体。
   * 
   * @example
   * // 获取电影详情
   * {
   *   "tmdbId": "550",
   *   "type": "movie"
   * }
   */
  getMediaDetails: z.object({
    /** TMDB数据库ID */
    tmdbId: CommonValidators.tmdbId,
    /** 媒体类型（电影或电视剧） */
    type: CommonValidators.mediaType
  }),

  /**
   * 媒体创建验证
   * 
   * 验证创建新媒体记录的完整数据。包含从TMDB获取的所有媒体信息，
   * 使用 z.coerce 自动处理数字类型转换，并为可选字段提供默认值。
   * 使用 .catch(null) 为日期转换失败提供容错处理。
   * 
   * @example
   * // 创建电影记录
   * {
   *   "type": "movie",
   *   "tmdbId": "550",
   *   "title": "搏击俱乐部",
   *   "originalTitle": "Fight Club",
   *   "releaseDate": "1999-10-15",
   *   "description": "一个失眠的上班族...",
   *   "runtime": "139",
   *   "voteAverage": "8.4"
   * }
   */
  createMedia: z.object({
    /** 媒体类型 */
    type: CommonValidators.mediaType,
    /** TMDB数据库ID */
    tmdbId: CommonValidators.tmdbId,
    /** 媒体标题 */
    title: CommonValidators.title,
    /** 原始标题（通常是英文） */
    originalTitle: CommonValidators.title,
    /** 发布日期，自动转换为Date对象，失败时返回null */
    releaseDate: z.coerce.date().nullable().catch(null),
    /** 媒体描述/简介 */
    description: CommonValidators.description,
    /** 海报图片路径，TMDB返回的相对路径如"/abc.jpg"或完整URL */
    posterPath: CommonValidators.imagePath,
    /** 背景图片路径，TMDB返回的相对路径如"/def.jpg"或完整URL */
    backdropPath: CommonValidators.imagePath,
    /** 类型标签数组 */
    genres: z.array(z.string()).default([]),
    /** 运行时长（分钟），自动转换为数字 */
    runtime: z.coerce.number().int().min(0).nullable().default(null),
    /** 制作预算，自动转换为数字 */
    budget: z.coerce.number().int().min(0).nullable().default(null),
    /** 票房收入，自动转换为数字 */
    revenue: z.coerce.number().int().min(0).nullable().default(null),
    /** 平均评分（0-10），自动转换为数字 */
    voteAverage: z.coerce.number().min(0).max(10).nullable().default(null),
    /** 评分人数，自动转换为数字 */
    voteCount: z.coerce.number().int().min(0).nullable().default(null),
    /** 热度值，自动转换为数字 */
    popularity: z.coerce.number().min(0).nullable().default(null),
    /** 是否为成人内容，自动转换为布尔值 */
    adult: CommonValidators.boolean.default(false),
    /** 是否为视频内容，自动转换为布尔值 */
    video: CommonValidators.boolean.default(false),
    /** 官方网站URL */
    homepage: CommonValidators.url,
    /** IMDB ID */
    imdbId: z.string().nullable().default(null),
    /** 原始语言代码 */
    originalLanguage: CommonValidators.languageCode,
    /** 制作公司列表 */
    productionCompanies: z.array(z.string()).default([]),
    /** 制作国家列表 */
    productionCountries: z.array(z.string()).default([]),
    /** 语言列表 */
    spokenLanguages: z.array(z.string()).default([]),
    /** 制作状态 */
    status: z.string().nullable().default(null),
    /** 宣传语 */
    tagline: z.string().nullable().default(null),
    /** 原始TMDB数据 */
    rawData: z.any()
  }),

  /**
   * 媒体更新验证
   * 
   * 验证更新媒体信息的请求数据。所有字段都是可选的，
   * 但至少需要提供一个字段进行更新。支持部分更新。
   * 
   * @example
   * // 更新媒体标题和描述
   * {
   *   "title": "新标题",
   *   "description": "新的描述信息"
   * }
   */
  updateMedia: z.object({
    /** 媒体标题（可选） */
    title: CommonValidators.title.optional(),
    /** 原始标题（可选） */
    originalTitle: CommonValidators.title.optional(),
    /** 媒体描述（可选） */
    description: CommonValidators.description.optional(),
    /** 海报图片路径（可选），TMDB相对路径或完整URL */
    posterPath: CommonValidators.imagePath.optional(),
    /** 背景图片路径（可选），TMDB相对路径或完整URL */
    backdropPath: CommonValidators.imagePath.optional(),
    /** 类型标签数组（可选） */
    genres: z.array(z.string()).optional(),
    /** 运行时长（可选） */
    runtime: z.coerce.number().int().min(0).nullable().optional(),
    /** 平均评分（可选） */
    voteAverage: z.coerce.number().min(0).max(10).nullable().optional(),
    /** 评分人数（可选） */
    voteCount: z.coerce.number().int().min(0).nullable().optional(),
    /** 热度值（可选） */
    popularity: z.coerce.number().min(0).nullable().optional(),
    /** 官方网站URL（可选） */
    homepage: CommonValidators.url.optional(),
    /** 制作状态（可选） */
    status: z.string().nullable().optional(),
    /** 宣传语（可选） */
    tagline: z.string().nullable().optional()
  }).refine(
    (data) => {
      // 至少要更新一个字段
      return Object.values(data).some(value => value !== undefined);
    },
    {
      message: '至少需要提供一个要更新的字段'
    }
  ),

  /**
   * 电视剧特有字段验证
   * 
   * 电视剧类型媒体的专有字段验证。包含季数、集数、播出时间等
   * 电视剧特有的信息。使用 z.coerce 自动处理类型转换。
   * 
   * @example
   * // 电视剧特有信息
   * {
   *   "numberOfSeasons": "8",
   *   "numberOfEpisodes": "73",
   *   "firstAirDate": "2011-04-17",
   *   "inProduction": "false"
   * }
   */
  tvShowFields: z.object({
    /** 季数，自动转换为数字，至少1季 */
    numberOfSeasons: z.coerce.number().int().min(1).nullable().default(null),
    /** 总集数，自动转换为数字，至少1集 */
    numberOfEpisodes: z.coerce.number().int().min(1).nullable().default(null),
    /** 每集时长数组，自动转换数字数组 */
    episodeRunTime: z.array(z.coerce.number()).default([]),
    /** 首播日期，自动转换为Date对象 */
    firstAirDate: z.coerce.date().nullable().catch(null),
    /** 最后播出日期，自动转换为Date对象 */
    lastAirDate: z.coerce.date().nullable().catch(null),
    /** 是否仍在制作中，自动转换为布尔值 */
    inProduction: CommonValidators.boolean.default(false),
    /** 播出网络列表 */
    networks: z.array(z.string()).default([]),
    /** 原产国家列表 */
    originCountry: z.array(z.string()).default([]),
    /** 季信息数组，包含每季的详细信息 */
    seasons: z.array(z.any()).default([])
  }),

  /**
   * 电影特有字段验证
   * 
   * 电影类型媒体的专有字段验证。包含预算、票房收入等
   * 电影特有的商业信息。使用 z.coerce 自动处理类型转换。
   * 
   * @example
   * // 电影特有信息
   * {
   *   "budget": "63000000",
   *   "revenue": "100853753",
   *   "belongsToCollection": {
   *     "id": 230,
   *     "name": "The Godfather Collection"
   *   }
   * }
   */
  movieFields: z.object({
    /** 制作预算，自动转换为数字 */
    budget: z.coerce.number().int().min(0).nullable().default(null),
    /** 票房收入，自动转换为数字 */
    revenue: z.coerce.number().int().min(0).nullable().default(null),
    /** 所属系列信息 */
    belongsToCollection: z.any().nullable().default(null)
  })
};

/**
 * 媒体相关的路径参数验证器
 * 
 * 用于验证URL路径中的参数，如媒体ID、TMDB ID等。
 * 这些验证器通常在Express路由的参数验证中使用。
 */
export const MediaParamValidators = {
  /**
   * TMDB ID路径参数验证
   * 
   * 验证URL路径中的TMDB ID参数。
   * 
   * @example
   * // 路由: /api/media/tmdb/:tmdbId
   * // URL: /api/media/tmdb/123456
   * // params: { tmdbId: "123456" }
   */
  tmdbId: z.object({
    /** TMDB数据库ID */
    tmdbId: CommonValidators.id
  }),

  /**
   * 媒体ID路径参数验证
   * 
   * 验证URL路径中的本地媒体ID参数。
   * 
   * @example
   * // 路由: /api/media/:id
   * // URL: /api/media/456
   * // params: { id: "456" }
   */
  mediaId: z.object({
    /** 本地媒体ID */
    id: CommonValidators.id
  }),

  /**
   * 媒体类型和TMDB ID路径参数验证
   * 
   * 同时验证媒体类型和TMDB ID的路径参数。
   * 
   * @example
   * // 路由: /api/media/:type/:tmdbId
   * // URL: /api/media/movie/123456
   * // params: { type: "movie", tmdbId: "123456" }
   */
  typeAndTmdbId: z.object({
    /** 媒体类型 */
    type: CommonValidators.mediaType,
    /** TMDB数据库ID */
    tmdbId: CommonValidators.id
  })
};

/**
 * 媒体相关的查询参数验证器
 * 
 * 用于验证GET请求的查询参数，包括分页、排序、筛选等功能。
 * 使用 z.coerce 自动处理URL参数的字符串到数字转换。
 */
export const MediaQueryValidators = {
  /**
   * 获取媒体列表查询参数
   * 
   * 验证媒体列表API的查询参数，支持类型筛选、类型筛选、
   * 年份筛选、排序和分页等功能。
   * 
   * @example
   * // 查询参数示例
   * ?type=movie&genre=action&year=2023&sortBy=popularity&sortOrder=desc&page=1&limit=20
   */
  getMediaList: z.object({
    /** 媒体类型筛选，可选 */
    type: CommonValidators.mediaType.optional(),
    /** 类型筛选，可选 */
    genre: z.string().min(1).max(50).optional(),
    /** 年份筛选，可选 */
    year: CommonValidators.year.optional(),
    /** 排序字段，默认按热度排序 */
    sortBy: z.enum(['popularity', 'release_date', 'vote_average', 'title'], {
      message: '排序字段必须是popularity、release_date、vote_average或title之一'
    }).default('popularity'),
    /** 排序方向，默认降序 */
    sortOrder: z.enum(['asc', 'desc'], {
      message: '排序方向必须是asc或desc'
    }).default('desc'),
    /** 页码，自动转换为数字，默认第1页 */
    page: z.coerce.number().int().min(1, 'page必须是正整数').default(1),
    /** 每页数量，自动转换为数字，默认20条，最大100条 */
    limit: z.coerce.number().int().min(1, 'limit必须是正整数').max(100, 'limit不能超过100').default(20)
  }),

  /**
   * 搜索媒体查询参数
   * 
   * 验证媒体搜索API的查询参数，支持关键词搜索、类型筛选等。
   * 
   * @example
   * // 搜索查询参数示例
   * ?q=复仇者联盟&type=movie&year=2019&includeAdult=false&page=1
   */
  searchMedia: z.object({
    /** 搜索关键词 */
    q: CommonValidators.searchQuery,
    /** 媒体类型筛选，可选 */
    type: CommonValidators.mediaType.optional(),
    /** 年份筛选，可选 */
    year: CommonValidators.year.optional(),
    /** 是否包含成人内容，默认false */
    includeAdult: CommonValidators.boolean.default(false),
    /** 页码，自动转换为数字，默认第1页 */
    page: z.coerce.number().int().min(1, 'page必须是正整数').default(1)
  }),

  /**
   * 获取热门媒体查询参数
   * 
   * 验证获取热门媒体的查询参数，支持时间窗口选择。
   * 
   * @example
   * // 热门媒体查询参数示例
   * ?type=tv&timeWindow=week&page=1
   */
  getTrendingMedia: z.object({
    /** 媒体类型筛选，可选 */
    type: CommonValidators.mediaType.optional(),
    /** 时间窗口，日或周，默认天 */
    timeWindow: z.enum(['day', 'week'], {
      message: '时间窗口必须是day或week'
    }).default('day'),
    /** 页码，自动转换为数字，默认第1页 */
    page: z.coerce.number().int().min(1, 'page必须是正整数').default(1)
  })
};

/**
 * 媒体数据模型验证器
 * 
 * 用于验证数据库模型数据的完整性和正确性。
 * 这些验证器主要用于内部数据验证，确保数据库操作的安全性。
 */
export const MediaModelValidators = {
  /**
   * 完整媒体信息验证
   * 
   * 验证数据库中完整的媒体记录数据。包含所有必要字段和
   * 时间戳信息。这是媒体数据的完整数据模型验证。
   * 
   * @example
   * // 完整媒体记录
   * {
   *   "id": 1,
   *   "type": "movie",
   *   "tmdbId": 550,
   *   "title": "搏击俱乐部",
   *   "createdAt": "2024-01-01T00:00:00Z",
   *   "updatedAt": "2024-01-01T00:00:00Z"
   * }
   */
  fullMediaInfo: z.object({
    /** 本地数据库ID */
    id: z.number().int().positive(),
    /** 媒体类型 */
    type: CommonValidators.mediaType,
    /** TMDB数据库ID */
    tmdbId: CommonValidators.tmdbId,
    /** 媒体标题 */
    title: CommonValidators.title,
    /** 原始标题 */
    originalTitle: CommonValidators.title,
    /** 发布日期 */
    releaseDate: z.date().nullable(),
    /** 媒体描述 */
    description: CommonValidators.description,
    /** 海报图片路径，TMDB相对路径或完整URL */
    posterPath: CommonValidators.imagePath,
    /** 背景图片路径，TMDB相对路径或完整URL */
    backdropPath: CommonValidators.imagePath,
    /** 类型标签数组 */
    genres: z.array(z.string()),
    /** 运行时长（分钟） */
    runtime: z.number().int().min(0).nullable(),
    /** 平均评分 */
    voteAverage: z.number().min(0).max(10).nullable(),
    /** 评分人数 */
    voteCount: z.number().int().min(0).nullable(),
    /** 热度值 */
    popularity: z.number().min(0).nullable(),
    /** 是否为成人内容 */
    adult: z.boolean(),
    /** 官方网站URL */
    homepage: CommonValidators.url,
    /** IMDB ID */
    imdbId: z.string().nullable(),
    /** 原始语言代码 */
    originalLanguage: z.string().min(2).max(5).nullable(),
    /** 制作状态 */
    status: z.string().nullable(),
    /** 宣传语 */
    tagline: z.string().nullable(),
    /** 创建时间 */
    createdAt: z.date(),
    /** 更新时间 */
    updatedAt: z.date(),
    /** 原始TMDB数据 */
    rawData: z.any()
  }),

  /**
   * 媒体文件关联信息验证
   * 
   * 验证媒体与文件系统文件的关联记录。包含媒体ID、
   * 文件路径、硬链接路径以及电视剧的季集信息。
   * 
   * @example
   * // 电影文件关联
   * {
   *   "mediaId": 1,
   *   "filePath": "/movies/fight_club.mp4",
   *   "linkPath": "/library/movies/Fight Club (1999).mp4",
   *   "episodeId": null,
   *   "seasonNumber": null,
   *   "episodeNumber": null
   * }
   * 
   * // 电视剧文件关联
   * {
   *   "mediaId": 2,
   *   "filePath": "/tv/game_of_thrones_s01e01.mp4",
   *   "linkPath": "/library/tv/Game of Thrones/Season 01/Game of Thrones - S01E01.mp4",
   *   "episodeId": 123,
   *   "seasonNumber": 1,
   *   "episodeNumber": 1
   * }
   */
  mediaFileLink: z.object({
    /** 关联的媒体ID */
    mediaId: z.number().int().positive(),
    /** 原始文件路径 */
    filePath: CommonValidators.filePath,
    /** 硬链接文件路径 */
    linkPath: CommonValidators.filePath,
    /** 剧集ID（仅电视剧） */
    episodeId: z.number().int().positive().nullable(),
    /** 季号（仅电视剧） */
    seasonNumber: CommonValidators.seasonNumber,
    /** 集号（仅电视剧） */
    episodeNumber: CommonValidators.episodeNumber,
    /** 创建时间 */
    createdAt: z.date(),
    /** 更新时间 */
    updatedAt: z.date()
  })
};
