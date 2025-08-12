import { z } from 'zod';
import { CommonValidators } from './common.validator';

/**
 * 系统模块验证器
 */
export const SystemValidator = {
  /**
   * 更新系统配置的验证规则
   * 
   * - 所有字段都是可选的，因为前端可能只发送变更的字段。
   * - 对URL和枚举值进行严格验证。
   * - 使用 refine 进行交叉字段验证，确保在启用特定提供商时，其相关字段也存在。
   */
  updateConfig: z.object({
    useLlm: CommonValidators.boolean.optional(),
    llmProvider: z.enum(['ollama', 'openai'], { message: 'LLM提供商必须是 "ollama" 或 "openai"' }).optional(),
    llmHost: z.string().url({ message: 'llmHost必须是有效的URL' }).optional(),
    llmModel: z.string().min(1, { message: 'llmModel不能为空' }).optional(),
    openaiApiKey: z.string().min(1, { message: 'openaiApiKey不能为空' }).optional(),
    openaiModel: z.string().min(1, { message: 'openaiModel不能为空' }).optional(),
    openaiBaseUrl: z.string().url({ message: 'openaiBaseUrl必须是有效的URL' }).optional(),
    llmPrompt: z.string().min(1, { message: 'llmPrompt不能为空' }).optional(),
    persistentLogging: CommonValidators.boolean.optional(),
  }).refine(data => {
    // 如果启用了LLM且提供商是ollama，则其相关字段必须存在
    if (data.useLlm && data.llmProvider === 'ollama') {
      return !!data.llmHost && !!data.llmModel;
    }
    return true;
  }, {
    message: '当LLM提供商为Ollama时，llmHost和llmModel为必填项',
    path: ['ollama'], // 关联错误到虚拟路径
  }).refine(data => {
    // 如果启用了LLM且提供商是openai，则其相关字段必须存在
    if (data.useLlm && data.llmProvider === 'openai') {
      return !!data.openaiApiKey && !!data.openaiModel && !!data.openaiBaseUrl;
    }
    return true;
  }, {
    message: '当LLM提供商为OpenAI时，openaiApiKey, openaiModel和openaiBaseUrl为必填项',
    path: ['openai'], // 关联错误到虚拟路径
  }),
};