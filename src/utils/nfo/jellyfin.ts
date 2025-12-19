import { XMLBuilder } from "fast-xml-parser";
import fs from "fs";
import path from "path";
import { logger } from "@/utils/logger";
import { IdentifiedMedia } from "@/types/media.types";

// 适配 fast-xml-parser 的带属性节点
// 例如: <uniqueid type="imdb" default="true">tt123456</uniqueid>
export interface XmlAttributeNode {
  "#text": string | number;
  [key: string]: any; // 用于捕获 @_type, @_default 等属性
}

export interface UniqueId extends XmlAttributeNode {
  "@_type": string; // 例如: "imdb", "tmdb", "tvdb"
  "@_default"?: string; // "true" or "false"
}

// 演员/演职人员结构
export interface Actor {
  name: string;
  role?: string; // 角色名
  type?: "Actor" | "Director" | "Writer" | "Producer" | "GuestStar"; // Jellyfin 扩展字段
  thumb?: string; // 头像 URL
  profile?: string; // 演员个人资料链接
  sortorder?: number; // 排序
}

// 电影
export interface MovieNfo {
  title: string;
  originaltitle?: string;
  sorttitle?: string;

  // 评分与元数据
  rating?: number;
  userrating?: number;
  year?: number | string;
  top250?: number;
  runtime?: number; // 分钟
  outline?: string; // 简短大纲
  plot?: string; // 完整简介
  tagline?: string;
  mpaa?: string; // 分级，如 PG-13

  // 关键 ID (最重要的部分)
  uniqueid: UniqueId[];

  // 列表型数据 (XML 中重复的标签)
  genre?: string[];
  country?: string[];
  tag?: string[];
  studio?: string[];

  // 人员
  director?: string[]; // 或者使用复杂的 Actor 结构，但通常 NFO 简单用名字
  credits?: string[]; // 编剧
  actor?: Actor[];

  // 媒体信息
  premiered?: string; // YYYY-MM-DD
  dateadded?: string; // YYYY-MM-DD HH:MM:SS

  // Jellyfin 特有控制
  lockdata?: boolean; // 是否锁定元数据，防止被自动刮削覆盖

  // 预告片与海报
  trailer?: string;
  poster?: string;
  thumb?: string;
  fanart?: string;
}

// 电视剧
export interface TvShowNfo {
  title: string;
  originaltitle?: string;
  showtitle?: string; // 有时用于区分
  sorttitle?: string;

  rating?: number;
  year?: number | string;
  season?: number; // 总季数 (不是当前季)
  episode?: number; // 总集数

  displayseason?: number;
  displayepisode?: number;

  plot?: string;
  outline?: string;
  mpaa?: string;

  status?: "Continuing" | "Ended"; // 剧集状态

  uniqueid: UniqueId[];

  genre?: string[];
  tag?: string[];
  studio?: string[];

  actor?: Actor[];

  premiered?: string;
  dateadded?: string;
  lockdata?: boolean;
}

// 电视剧单集
export interface EpisodeNfo {
  title: string;
  showtitle?: string; // 所属剧集名

  rating?: number;
  season: number; // 第几季 (必须)
  episode: number; // 第几集 (必须)

  // 双集或特殊排序
  displayseason?: number;
  displayepisode?: number;

  plot?: string;
  runtime?: number;

  uniqueid: UniqueId[];

  aired?: string; // 首播日期 YYYY-MM-DD

  director?: string[];
  credits?: string[]; // 编剧
  actor?: Actor[]; // 单集客串演员 (Guest Stars)

  thumb?: string; // 单集缩略图

  lockdata?: boolean;
}

/**
 * 通用构建函数
 * @param rootName - 根节点名称 ('movie', 'tvshow', 'episodedetails')
 * @param data - 数据对象
 */
export type NfoRootName = "movie" | "tvshow" | "episodedetails";

/**
 * 转义 plot 文本中的换行符为 \n
 * @param text - 原始文本
 * @returns 转义后的文本
 */
const escapePlotText = (text: string | null | undefined): string | undefined => {
  if (!text) return undefined;
  return text.replace(/\n/g, '\\n').replace(/\r/g, '');
};

export const buildNfo = (
  rootName: NfoRootName,
  data: MovieNfo | TvShowNfo | EpisodeNfo
): string => {
  const builder = new XMLBuilder({
    ignoreAttributes: false, // 开启属性支持
    format: true, // 美化输出
    suppressEmptyNode: true, // 忽略空值
    suppressBooleanAttributes: false, // 不省略布尔属性值
    attributeNamePrefix: "@_", // 匹配我们在接口中定义的 key
  });
  // Jellyfin NFO 标准头部
  const xmlContent = builder.build({ [rootName]: data });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xmlContent}`;
};

/**
 * 将 IdentifiedMedia 转换为对应的 NFO 数据类型
 * @param media - 识别到的媒体信息
 * @returns NFO 数据对象和对应的根节点名称
 */
export const convertMediaToNfo = (
  media: IdentifiedMedia
): { rootName: NfoRootName; data: MovieNfo | TvShowNfo | EpisodeNfo } => {
  // 构建基础的 uniqueid
  const uniqueid: UniqueId[] = [
    {
      "#text": media.tmdbId.toString(),
      "@_type": "tmdb",
      "@_default": "true",
    },
  ];

  // 提取公共字段
  const baseFields = {
    title: media.title,
    originaltitle: media.originalTitle || undefined,
    plot: escapePlotText(media.description),
    uniqueid,
    premiered: media.releaseDate?.toISOString().split('T')[0],
  };

  // 根据媒体类型转换
  switch (media.type) {
    case "movie": {
      const movieNfo: MovieNfo = {
        ...baseFields,
        year: media.releaseDate?.getFullYear(),
        poster: media.posterPath || undefined,
        fanart: media.backdropPath || undefined,
      };
      return { rootName: "movie", data: movieNfo };
    }

    case "tv": {
      // 如果有季和集信息，生成单集 NFO
      if (media.seasonNumber !== undefined && media.episodeNumber !== undefined) {
        const episodeNfo: EpisodeNfo = {
          title: media.episodeTitle || media.title,
          showtitle: media.title,
          season: media.seasonNumber,
          episode: media.episodeNumber,
          plot: escapePlotText(media.episodeDescription || media.description),
          uniqueid,
          aired: media.releaseDate?.toISOString().split('T')[0],
        };
        return { rootName: "episodedetails", data: episodeNfo };
      }

      // 否则生成剧集 NFO
      const tvShowNfo: TvShowNfo = {
        ...baseFields,
      };
      return { rootName: "tvshow", data: tvShowNfo };
    }

    case "collection":
    default: {
      // collection 类型或其他未知类型默认作为电影处理
      const movieNfo: MovieNfo = {
        ...baseFields,
      };
      return { rootName: "movie", data: movieNfo };
    }
  }
};

/**
 * 创建并保存 NFO 文件。
 * 
 * 该函数根据提供的数据构建 NFO 内容，并将其异步写入到指定的文件路径。
 * 写入过程中会捕获异常并记录相应的日志信息。
 *
 * @param filePath - NFO 文件保存的完整路径。
 * @param rootName - NFO XML 结构的根节点名称（例如 'movie', 'tvshow' 或 'episodedetails'）。
 * @param data - 要写入 NFO 的数据对象，支持电影、剧集或单集的信息。
 * 
 * @throws {Error} 当文件写入操作失败时，错误会被捕获并记录到日志中。
 */
export const createNfoFile = (
  filePath: string,
  rootName: NfoRootName,
  data: MovieNfo | TvShowNfo | EpisodeNfo
): void => {
  const nfoContent = buildNfo(rootName, data);
  try {
    fs.writeFileSync(filePath, nfoContent, "utf-8");
    logger.info(`创建 NFO 文件成功: ${filePath}`);
  } catch (error) {
    logger.error("创建 NFO 文件失败:", error);
  }
};

/**
 * 从 IdentifiedMedia 直接创建 NFO 文件
 * @param filePath - NFO 文件保存路径（支持相对路径和绝对路径）
 * @param media - 识别到的媒体信息
 */
export const createNfoFromMedia = (
  filePath: string,
  media: IdentifiedMedia
): void => {
  // 如果是相对路径，转换为绝对路径
  const absolutePath = path.isAbsolute(filePath) 
    ? filePath 
    : path.resolve(process.cwd(), filePath);
  
  const { rootName, data } = convertMediaToNfo(media);
  createNfoFile(absolutePath, rootName, data);
};
