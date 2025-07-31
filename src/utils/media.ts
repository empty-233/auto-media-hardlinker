import fs from "fs";
import path from "path";
import axios from "axios";
import { logger } from "./logger";
import { MovieResult, TvResult } from "moviedb-promise";

// 图片存储目录
const IMAGE_DIR = path.join(process.cwd(), "public", "images", "tmdb");
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/";
const POSTER_SIZE = "w500";
const BACKDROP_SIZE = "w780";
const STILL_SIZE = "w300";

// 确保图片存储目录存在
function ensureImageDirExists() {
  const dirs = [
    path.join(IMAGE_DIR, "posters"),
    path.join(IMAGE_DIR, "backdrops"),
    path.join(IMAGE_DIR, "stills"),
  ];

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`创建图片目录: ${dir}`);
    }
  });
}

// 初始化图片目录
ensureImageDirExists();

/**
 * 下载并保存TMDB图片
 * @param imagePath TMDB图片路径后缀
 * @param type 图片类型（poster, backdrop, still）
 * @returns 本地保存的图片URL路径或null（如果下载失败）
 */
export async function downloadTMDBImage(
  imagePath: string | null | undefined,
  type: "poster" | "backdrop" | "still"
): Promise<string | null> {
  if (!imagePath) return null;

  try {
    const size =
      type === "poster"
        ? POSTER_SIZE
        : type === "backdrop"
        ? BACKDROP_SIZE
        : STILL_SIZE;
    const imageUrl = `${TMDB_IMAGE_BASE_URL}${size}${imagePath}`;
    const fileName = path.basename(imagePath);
    const localDir = path.join(IMAGE_DIR, `${type}s`);
    const localPath = path.join(localDir, fileName);

    if (fs.existsSync(localPath)) {
      logger.debug(`图片已存在，直接返回路径: ${localPath}`);
      return `/images/tmdb/${type}s/${fileName}`;
    }

    logger.info(`下载TMDB图片: ${imageUrl}`);
    const response = await axios({
      method: "get",
      url: imageUrl,
      responseType: "stream",
    });

    const writer = fs.createWriteStream(localPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        logger.info(`成功保存图片: ${localPath}`);
        resolve(`/images/tmdb/${type}s/${fileName}`);
      });
      writer.on("error", (err) => {
        logger.error(`保存图片失败`, err);
        reject(err);
      });
    });
  } catch (error: any) {
    logger.error(`下载TMDB图片失败`, error);
    return null;
  }
}

/**
 * 获取媒体项的名称。
 */
export function getMediaName(
  mediaItem: MovieResult | TvResult | { name?: string; title?: string }
): string | undefined {
  if ("name" in mediaItem) {
    return mediaItem.name;
  } else if ("title" in mediaItem) {
    return mediaItem.title;
  }
  return undefined;
}

/**
 * 根据媒体类型获取正确的发布日期
 */
export function getMediaReleaseDate(
  media: any,
  type: string | null
): Date | null {
  if (!media) return null;

  let dateString: string | undefined;

  if (type === "movie") {
    dateString = media.release_date;
  } else if (type === "tv") {
    dateString = media.first_air_date;
  }

  if (dateString) {
    return new Date(dateString);
  }
  
  return null;
}

/**
 * 辅助函数，将日期字符串转换为有效的日期时间格式
 * @param dateStr 日期字符串
 * @returns Date对象或null
 */
export const formatDate = (
  dateStr: string | Date | null | undefined
): Date | null => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) {
    return dateStr;
  }
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch (error) {
    logger.error(`日期格式化错误`, error);
    return null;
  }
};