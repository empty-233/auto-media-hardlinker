/**
 * 系统配置接口
 */
export interface SystemConfig {
  useLlm: boolean
  llmHost: string
  llmModel: string
}

/**
 * 更新配置请求参数
 */
export interface UpdateConfigParams {
  useLlm?: boolean
  llmHost?: string
  llmModel?: string
}
