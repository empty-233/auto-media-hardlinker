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
    } catch {
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

/**
 * 递归创建文件夹硬链接
 * 将源文件夹下的所有文件和子文件夹结构完整复制到目标位置（通过硬链接）
 * @param sourcePath - 源文件夹路径
 * @param targetPath - 目标文件夹路径
 * @returns Promise<void>
 * @throws 如果递归创建硬链接失败，则抛出错误
 */
export async function createHardlinkRecursively(
  sourcePath: string,
  targetPath: string
): Promise<void> {
  try {
    const entries = await fs.promises.readdir(sourcePath, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourceItemPath = path.join(sourcePath, entry.name);
      const targetItemPath = path.join(targetPath, entry.name);
      
      if (entry.isDirectory()) {
        // 创建目标子文件夹
        await fs.promises.mkdir(targetItemPath, { recursive: true });
        
        // 递归处理子文件夹
        await createHardlinkRecursively(sourceItemPath, targetItemPath);
      } else {
        // 创建文件硬链接
        try {
          await fs.promises.link(sourceItemPath, targetItemPath);
          logger.debug(`创建硬链接: ${sourceItemPath} -> ${targetItemPath}`);
        } catch (error: any) {
          if (error.code === 'EEXIST') {
            logger.debug(`文件已存在，跳过: ${targetItemPath}`);
          } else {
            logger.error(`创建硬链接失败: ${sourceItemPath} -> ${targetItemPath} - ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    }
  } catch (error) {
    logger.error(`递归创建硬链接失败: ${sourcePath}`, error);
    throw error;
  }
}

/**
 * 删除指定路径的文件。
 * @param filePath - 要删除的文件路径
 * @returns Promise<void>
 * @throws 如果删除失败（权限问题等），则抛出错误。
 */
export async function deleteHardlink(filePath: string): Promise<void> {
  try {
    // 1. 检查文件是否存在
    await fs.promises.access(filePath, fs.constants.F_OK);

    // 2. 删除文件
    await fs.promises.unlink(filePath);
    logger.info(`成功删除文件: ${filePath}`);
  } catch (error: any) {
    let errorMessage = `删除文件失败: "${filePath}".`;
    if (error.code === 'ENOENT') {
      // 如果文件已经不存在，这通常不是一个需要上报的错误，可以静默处理或只记录警告。
      logger.warn(errorMessage + " 原因: 文件不存在。可能已被提前删除。");
      return; // 操作目标已不存在，可视为成功
    } else if (error.code === 'EPERM' || error.code === 'EACCES') {
      errorMessage += " 原因: 权限不足。";
    } else {
      errorMessage += ` 原因: 未知错误 (${error.message})`;
    }
    logger.error(errorMessage, error);
    throw new Error(errorMessage); // 重新抛出错误，以便上层调用者可以捕获
  }
}