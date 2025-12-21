/**
 * 系统配置接口
 */
export interface SystemConfig {
  tmdbApi: string
  useLlm: boolean
  llmProvider: 'ollama' | 'openai'
  llmHost: string
  llmModel: string
  openaiApiKey: string
  openaiModel: string
  openaiBaseUrl: string
  llmPrompt: string
  llmSpecialFolderPrompt: string
  persistentLogging: boolean
}

/**
 * 更新配置请求参数
 * 使用 Partial<SystemConfig> 表示所有字段都是可选的
 */
export type UpdateConfigParams = Partial<SystemConfig>
