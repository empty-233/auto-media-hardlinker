import crypto from 'crypto';
import fs from 'fs/promises';

/**
 * 生成文件/文件夹路径的 MD5 哈希值
 * @param path 文件或文件夹的完整路径
 * @returns MD5 哈希值（16进制字符串）
 */
export function generatePathHash(path: string): string {
  return crypto.createHash('md5').update(path).digest('hex');
}

/**
 * 文件/文件夹的设备信息
 */
export interface FileDeviceInfo {
  deviceId: bigint;
  inode: bigint;
  size: bigint;
}

/**
 * 获取文件或文件夹的设备信息
 * @param path 文件或文件夹路径
 * @returns 设备ID、inode和大小信息
 */
export async function getFileDeviceInfo(path: string): Promise<FileDeviceInfo> {
  const stats = await fs.stat(path);
  return {
    deviceId: BigInt(stats.dev),
    inode: BigInt(stats.ino),
    size: BigInt(stats.size)
  };
}

/**
 * 计算文件内容的 MD5 哈希值
 * 采用头部、中部、尾部采样的方式，适用于大文件的快速哈希计算
 * @param filePath 文件路径
 * @param fileSize 文件大小（字节）
 * @returns 文件内容的 MD5 哈希值
 */
export async function calculateFileHash(
  filePath: string,
  fileSize: number
): Promise<string> {
  const hashSum = crypto.createHash("md5");
  let fileHandle;
  try {
    fileHandle = await fs.open(filePath, "r");
    const bufferSize = 1024 * 1024; // 1MB
    const buffer = Buffer.alloc(bufferSize);

    // 读取文件头部
    const { bytesRead: headBytesRead } = await fileHandle.read(
      buffer,
      0,
      Math.min(bufferSize, fileSize),
      0
    );
    hashSum.update(buffer.slice(0, headBytesRead));

    // 如果文件足够大，读取中部
    if (fileSize > bufferSize * 2) {
      const { bytesRead: midBytesRead } = await fileHandle.read(
        buffer,
        0,
        bufferSize,
        Math.floor(fileSize / 2) - bufferSize / 2
      );
      hashSum.update(buffer.slice(0, midBytesRead));
    }

    // 如果文件大于1MB，读取尾部
    if (fileSize > bufferSize) {
      const { bytesRead: tailBytesRead } = await fileHandle.read(
        buffer,
        0,
        Math.min(bufferSize, fileSize),
        Math.max(0, fileSize - bufferSize)
      );
      hashSum.update(buffer.slice(0, tailBytesRead));
    }

    // 将文件大小也加入哈希计算，确保不同大小的文件有不同的哈希
    hashSum.update(fileSize.toString());
    return hashSum.digest("hex");
  } finally {
    await fileHandle?.close();
  }
}
