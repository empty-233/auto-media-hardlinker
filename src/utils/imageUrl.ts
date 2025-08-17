import { env } from "../config/env";

/**
 * 图片URL处理工具
 */
export class ImageUrlHelper {
  private static baseUrl: string = env.IMAGE_BASE_URL;

  /**
   * 拼接完整的图片URL
   * @param posterUrl 相对图片路径
   * @returns 完整的图片URL
   */
  static getFullImageUrl(posterUrl: string | null): string | null {
    if (!posterUrl) {
      return null;
    }
    
    // 如果已经是完整URL，直接返回
    if (posterUrl.startsWith('http://') || posterUrl.startsWith('https://')) {
      return posterUrl;
    }
    
    // 确保路径以 / 开头
    const normalizedPath = posterUrl.startsWith('/') ? posterUrl : `/${posterUrl}`;
    
    // 拼接完整URL
    return `${this.baseUrl}${normalizedPath}`;
  }

  /**
   * 处理媒体对象的图片URL
   * @param media 媒体对象
   * @returns 处理后的媒体对象
   */
  static processMediaImageUrl<T extends { posterUrl: string | null }>(media: T): T {
    return {
      ...media,
      posterUrl: this.getFullImageUrl(media.posterUrl)
    };
  }

  /**
   * 批量处理媒体数组的图片URL
   * @param mediaList 媒体数组
   * @returns 处理后的媒体数组
   */
  static processMediaListImageUrls<T extends { posterUrl: string | null }>(mediaList: T[]): T[] {
    return mediaList.map(media => this.processMediaImageUrl(media));
  }
}

export default ImageUrlHelper;
