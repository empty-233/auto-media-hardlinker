import http from '@/utils/http'
import type { SystemConfig, UpdateConfigParams } from './types'

/**
 * 系统配置API服务
 */
export class ConfigService {
  /**
   * 获取系统配置
   */
  static async getConfig(): Promise<SystemConfig> {
    return http.get<SystemConfig>('/config')
  }

  /**
   * 更新系统配置
   */
  static async updateConfig(params: UpdateConfigParams): Promise<SystemConfig> {
    return http.put<SystemConfig>('/config', params)
  }
}
