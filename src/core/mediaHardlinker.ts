import { Type } from "@prisma/client";
import { getConfig } from "../config/config";
import { fileMonitor } from "./fileMonitor";
import {
  RetrieveTMDBInfo,
  TMDBData,
  getMediaName,
  getMediaReleaseDate,
  downloadTMDBImage,
} from "./mediaData";
import { RetrieveLLMInfo } from "./LLMmediaData";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { logger } from "../utils/logger";
import prisma from "../client";

const config = getConfig();

// 添加一个辅助函数，将日期字符串转换为有效的日期时间格式
const formatDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;
  try {
    // 确保日期是有效的ISO格式
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch (error) {
    logger.error(`日期格式化错误: ${error}`);
    return null;
  }
};

const saveToDatabase = async (
  mediaInfo: TMDBData,
  sourcePath: string,
  fileName: string,
  targetPath: string,
  targetFileName: string
) => {
  try {
    // 获取文件系统信息
    const stats = fs.statSync(sourcePath);
    const deviceId = stats.dev;
    const inode = stats.ino;
    const fileSize = stats.size;
    // 计算文件路径
    const fullLinkPath = path.join(targetPath, targetFileName);

    // 计算文件MD5哈希
    const calculateFileHash = (filePath: string, fileSize: number): string => {
      const hashSum = crypto.createHash("md5");
      const fd = fs.openSync(filePath, "r");

      // 读取文件的三个关键部分: 开头、中间和结尾
      const bufferSize = 1024 * 1024; // 1MB
      const buffer = Buffer.alloc(bufferSize);

      // 读取开头部分
      fs.readSync(fd, buffer, 0, Math.min(bufferSize, fileSize), 0);
      hashSum.update(buffer.slice(0, Math.min(bufferSize, fileSize)));

      // 读取中间部分（如果文件足够大）
      if (fileSize > bufferSize * 2) {
        fs.readSync(
          fd,
          buffer,
          0,
          bufferSize,
          Math.floor(fileSize / 2) - bufferSize / 2
        );
        hashSum.update(buffer);
      }

      // 读取结尾部分（如果文件足够大）
      if (fileSize > bufferSize) {
        fs.readSync(
          fd,
          buffer,
          0,
          Math.min(bufferSize, fileSize),
          Math.max(0, fileSize - bufferSize)
        );
        hashSum.update(buffer.slice(0, Math.min(bufferSize, fileSize)));
      }

      // 将文件大小也作为哈希因子
      hashSum.update(fileSize.toString());

      fs.closeSync(fd);
      return hashSum.digest("hex");
    };

    const fileHash = calculateFileHash(sourcePath, fileSize);

    const tmdbId = mediaInfo.data.id;
    if (!tmdbId) throw new Error("没有找到TMDB ID");
    if (!mediaInfo.info.selectedData) throw new Error("没有找到媒体数据");

    const title = getMediaName(mediaInfo.info.selectedData[0]) || "";
    const description = mediaInfo.info.selectedData[0].overview || null;

    // 下载并获取本地图片URL - 只下载poster图片
    const posterPath = mediaInfo.info.selectedData[0].poster_path || null;

    // 下载海报图片
    const localPosterUrl = await downloadTMDBImage(posterPath, "poster");
    logger.info(`图片本地URL: 海报=${localPosterUrl}`);

    // 创建或查找Media记录
    let media;
    if (mediaInfo.type === null) throw new Error("没有找到媒体类型");
    // 查找是否已存在该TMDB ID的媒体
    const existingMedia = await prisma.media.findFirst({
      where: {
        tmdbId,
        type: mediaInfo.type.toLowerCase() as Type,
      },
    });
    if (existingMedia) {
      media = existingMedia;
      // 如果已存在媒体记录但缺少本地图片，则更新图片URL
      if (!existingMedia.posterUrl && localPosterUrl) {
        await prisma.media.update({
          where: { id: existingMedia.id },
          data: {
            posterUrl: localPosterUrl,
          },
        });
        logger.info(`更新了已存在媒体(ID=${existingMedia.id})的海报URL`);
      }
    } else {
      // 创建Media记录
      media = await prisma.media.create({
        data: {
          type: mediaInfo.type.toLowerCase() as Type,
          tmdbId,
          title: title,
          originalTitle: mediaInfo.title,
          releaseDate: getMediaReleaseDate(
            mediaInfo.info.selectedData[0],
            mediaInfo.type
          ),
          description,
          posterUrl: localPosterUrl,
        },
      });
    }
    // 根据媒体类型创建或更新额外信息
    if (mediaInfo.type === "tv" && mediaInfo.data) {
      // 检查该电视剧在数据库中是否已存在
      const existingTvInfo = await prisma.tvInfo.findFirst({
        where: {
          tmdbId,
        },
      });

      let tvInfo;

      if (existingTvInfo) {
        // 如果已存在，则更新信息
        logger.info(`更新已存在电视剧信息 TMDB ID: ${tmdbId}`);
        tvInfo = await prisma.tvInfo.update({
          where: { id: existingTvInfo.id },
          data: {
            description: description || existingTvInfo.description,
          },
        });
      } else {
        // 不存在则创建新的电视剧信息
        logger.info(`创建新电视剧信息 TMDB ID: ${tmdbId}`);
        tvInfo = await prisma.tvInfo.create({
          data: {
            tmdbId,
            description,
          },
        });
      }

      // 关联到媒体
      await prisma.media.update({
        where: { id: media.id },
        data: { tvInfoId: tvInfo.id },
      });

      // 如果有剧集信息，创建或更新剧集记录
      if (
        mediaInfo.episode &&
        mediaInfo.episodeTitle &&
        mediaInfo.data.episodes
      ) {
        let currentEpisodeInfoId: number | null = null;

        for (const episode of mediaInfo.data.episodes) {
          if (!episode.episode_number) throw new Error("没有找到集数");
          if (episode.id) {
            // 检查是否是当前文件对应的剧集
            const isCurrentEpisode =
              episode.episode_number ===
              parseInt(String(mediaInfo.episode), 10);

            // 下载剧集截图
            const localStillUrl = await downloadTMDBImage(
              episode.still_path,
              "still"
            );

            // 检查该剧集在数据库中是否已存在（通过tmdbId和tvInfoId查找）
            const existingEpisode = await prisma.episodeInfo.findFirst({
              where: {
                tmdbId: episode.id,
                tvInfoId: tvInfo.id,
              },
            });

            let episodeInfo;

            if (existingEpisode) {
              // 如果已存在，则更新信息
              logger.info(`更新已存在剧集信息 TMDB ID: ${episode.id}`);
              episodeInfo = await prisma.episodeInfo.update({
                where: { id: existingEpisode.id },
                data: {
                  title: episode.name,
                  description: episode.overview,
                  episodeNumber: episode.episode_number,
                  // 仅当现有图片URL为空或新的图片URL不为空时才更新
                  ...(!existingEpisode.posterUrl && localStillUrl
                    ? { posterUrl: localStillUrl }
                    : {}),
                },
              });
            } else {
              // 不存在则创建新的剧集信息
              logger.info(`创建新剧集信息 TMDB ID: ${episode.id}`);
              episodeInfo = await prisma.episodeInfo.create({
                data: {
                  tmdbId: episode.id,
                  episodeNumber: episode.episode_number,
                  title: episode.name,
                  releaseDate: formatDate(episode.air_date),
                  description: episode.overview,
                  posterUrl: localStillUrl,
                  tvInfoId: tvInfo.id,
                },
              });
            }

            // 如果是当前处理的集数，记录其ID用于文件关联
            if (isCurrentEpisode) {
              currentEpisodeInfoId = episodeInfo.id;
            }
          }
        }

        // 创建File记录，并关联到当前剧集（如果有）
        await prisma.file.create({
          data: {
            deviceId,
            inode,
            fileHash,
            fileSize,
            filePath: sourcePath,
            linkPath: fullLinkPath,
            // 使用关系对象而不是直接ID
            Media: { connect: { id: media.id } },
            // 修改关系名称从 episodeInfo 到 episode，与 Schema 保持一致
            ...(currentEpisodeInfoId
              ? { episode: { connect: { id: currentEpisodeInfoId } } }
              : {}),
          },
        });

        logger.info(`成功将文件 "${fileName}" 信息保存到数据库`);
        return; // 已创建完文件记录，提前返回
      }
    } else if (mediaInfo.type === "movie") {
      // 创建电影信息
      const tmdbId = mediaInfo.data.id;
      if (tmdbId) {
        const movieInfo = await prisma.movieInfo.create({
          data: {
            tmdbId,
            description: mediaInfo.data.overview,
          },
        });
        // 关联到媒体
        await prisma.media.update({
          where: { id: media.id },
          data: { movieInfoId: movieInfo.id },
        });
      }
    }

    // 如果没有在前面创建文件记录（例如已存在媒体或是电影），在这里创建
    await prisma.file.create({
      data: {
        deviceId,
        inode,
        fileHash,
        fileSize,
        filePath: sourcePath,
        linkPath: fullLinkPath,
        // 修改为使用关系对象
        Media: { connect: { id: media.id } },
      },
    });

    logger.info(`成功将文件 "${fileName}" 信息保存到数据库`);
  } catch (dbErr) {
    console.error("数据库操作失败:", dbErr);
  }
};

if (!config.monitorFilePath || !fs.existsSync(config.monitorFilePath)) {
  console.error("配置中的无效或未定义的监视器文件路径");
  process.exit(1);
}

const fileMonitorInstance = new fileMonitor(config.monitorFilePath, {
  usePolling: true,
});
fileMonitorInstance.watchFile((eventType, fileInfo) => {
  if (eventType === "add" || eventType === "addDir" || eventType === "change") {
    console.log(
      `类型：${eventType}，路径：${fileInfo.path}，文件名：${fileInfo.filename}，是否为目录：${fileInfo.isDirectory}`
    );

    // 获取文件扩展名
    const fileExt = path.extname(fileInfo.filename);

    // 根据配置决定使用LLM还是TMDB进行刮削
    const refreshConfig = getConfig(false);
    const retrieveInfoPromise = refreshConfig.useLlm
      ? RetrieveLLMInfo(fileInfo.filename, fileInfo.isDirectory, fileInfo.path)
      : RetrieveTMDBInfo(
          fileInfo.filename,
          fileInfo.isDirectory,
          fileInfo.path
        );

    retrieveInfoPromise
      .then((TMDBData) => {
        if (!TMDBData.info.selectedData) throw new Error("没有找到媒体数据");
        const mediaName = getMediaName(TMDBData.info.selectedData[0]);
        if (!mediaName) throw new Error("没有找到媒体名称");

        if (!TMDBData || !TMDBData.data) {
          console.error("无法获取媒体数据: ", fileInfo.filename);
          return;
        }
        if (TMDBData.type === "tv")
          if (!TMDBData.data.name) {
            console.error("无法获取媒体数据: 缺少名称", fileInfo.filename);
            return;
          }

        console.log("TMDB 数据：", TMDBData);

        let targetPath = path.join(config.targetFilePath, mediaName);
        if (TMDBData.type === "tv" && TMDBData.data.name)
          targetPath = path.join(targetPath, TMDBData.data.name);

        if (fileInfo.isDirectory) {
          console.log(targetPath);

          try {
            fs.mkdirSync(targetPath, { recursive: true });
          } catch (error) {
            console.error(`创建目录 "${targetPath}" 失败:`, error);
          }
        } else {
          const videoExtensions = [
            ".mp4",
            ".mkv",
            ".avi",
            ".mov",
            ".wmv",
            ".flv",
            ".webm",
            ".m4v",
            ".mpg",
            ".mpeg",
            ".ts",
          ];
          if (videoExtensions.includes(fileExt.toLowerCase())) {
            console.log(TMDBData.data);

            // 替换连字符为空格
            const clean = (str?: string) => str?.replace(/-/g, " ") || "";

            // 使用清理函数直接构建文件名
            let targetFileName = "";
            if (TMDBData.type === "tv") {
              if (!TMDBData.episode) throw new Error("没有找到集数");
              targetFileName += `${clean(mediaName)} S${TMDBData.season}E${
                TMDBData.episode
              } ${clean(TMDBData.episodeTitle)}`;
            }
            if (TMDBData.type === "movie") targetFileName += mediaName;
            targetFileName += fileExt;

            if (!fs.existsSync(targetPath)) {
              try {
                fs.mkdirSync(targetPath, { recursive: true });
              } catch (error) {
                console.error(`创建目录 "${targetPath}" 失败:`, error);
              }
            }

            // 创建硬链接并处理结果
            const targetFilePath = path.join(targetPath, targetFileName);
            fs.promises
              .link(fileInfo.path, targetFilePath)
              .then(() => {
                console.log(
                  `成功创建硬链接: 源文件 "${fileInfo.path}" -> 目标文件 "${targetFilePath}"`
                );
                // 这里可以添加更多处理，如更新数据库等
                saveToDatabase(
                  TMDBData,
                  fileInfo.path,
                  fileInfo.filename,
                  targetPath,
                  targetFileName
                );
              })
              .catch((error) => {
                console.error(
                  `创建硬链接失败: ${fileInfo.path} -> ${targetFilePath}`,
                  error
                );
              });
          }
        }
      })
      .catch((err) => {
        console.error(`处理文件 ${fileInfo.filename} 时出错:`, err);
      });
  }
});
