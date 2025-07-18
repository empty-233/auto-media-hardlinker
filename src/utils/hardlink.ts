import fs from "fs";
import path from "path";
import { logger } from "./logger";

/**
 * 创建从源路径到目标路径的硬链接。
 * 包含详细的错误处理和前置检查。
 * @param sourcePath - 源文件路径
 * @param targetPath - 目标文件路径
 * @returns Promise<void>
 * @throws 如果源文件不存在、目标目录无法访问或链接创建失败，则抛出错误。
 */
export async function createHardlink(
  sourcePath: string,
  targetPath: string
): Promise<void> {
  try {
    // 1. 检查源文件是否存在
    await fs.promises.access(sourcePath, fs.constants.F_OK);

    // 2. 确保目标目录存在
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
      logger.info(`创建目标目录: ${targetDir}`);
    }

    // 3. 检查目标文件是否已存在
    try {
      await fs.promises.access(targetPath, fs.constants.F_OK);
      logger.warn(`目标文件已存在，跳过创建硬链接: ${targetPath}`);
      return; // 文件已存在，直接返回
    } catch (error) {
      // 文件不存在，这是预期的，可以继续
    }

    // 4. 创建硬链接
    await fs.promises.link(sourcePath, targetPath);
    logger.info(`成功创建硬链接: ${sourcePath} -> ${targetPath}`);
  } catch (error: any) {
    let errorMessage = `创建硬链接失败: 从 "${sourcePath}" 到 "${targetPath}".`;
    switch (error.code) {
      case "ENOENT":
        errorMessage += " 原因: 源文件或路径不存在。";
        break;
      case "EEXIST":
        errorMessage += " 原因: 目标文件已存在（在并发情况下可能发生）。";
        break;
      case "EPERM":
      case "EACCES":
        errorMessage += " 原因: 权限不足。";
        break;
      default:
        errorMessage += ` 原因: 未知错误 (${error.message})`;
    }
    logger.error(errorMessage, error);
    throw new Error(errorMessage); // 重新抛出错误，以便上层调用者可以捕获
  }
}