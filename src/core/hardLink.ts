import fs from "fs";
import path from "path";

/**
 * 创建硬链接
 * @param sourcePath 源文件路径
 * @param targetPath 目标文件路径
 * @returns 成功返回true，失败返回false
 */
export function hardLinkSync(sourcePath: string, targetPath: string): boolean {
  try {
    // 检查源文件是否存在
    if (!fs.existsSync(sourcePath)) {
      console.error(`源文件不存在: ${sourcePath}`);
      return false;
    }

    // 确保目标目录存在
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 如果目标文件已存在，先删除
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }

    // 创建硬链接
    fs.linkSync(sourcePath, targetPath);
    return true;
  } catch (error) {
    console.error(`创建硬链接失败: ${error}`);
    return false;
  }
}
