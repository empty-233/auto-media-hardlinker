<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Link, Cpu, Document } from '@element-plus/icons-vue'
import { ConfigService } from '@/api/config'
import type { SystemConfig, UpdateConfigParams } from '@/api/config/types'

// 表单引用
const configFormRef = ref<FormInstance>()

// 加载状态
const loading = ref(false)
const saveLoading = ref(false)
const switchLoading = ref(false)

// 表单数据
const configForm = reactive<SystemConfig>({
  tmdbApi: '',
  useLlm: false,
  llmProvider: 'ollama',
  llmHost: '',
  llmModel: '',
  openaiApiKey: '',
  openaiModel: '',
  openaiBaseUrl: '',
  llmPrompt: '',
  persistentLogging: true
})

// 原始数据备份
const originalConfig = ref<SystemConfig>({
  tmdbApi: '',
  useLlm: false,
  llmProvider: 'ollama',
  llmHost: '',
  llmModel: '',
  openaiApiKey: '',
  openaiModel: '',
  openaiBaseUrl: '',
  llmPrompt: '',
  persistentLogging: true
})

// 表单验证规则
const configRules = reactive<FormRules<SystemConfig>>({
  tmdbApi: [
    { required: true, message: 'TMDB API Key 不能为空', trigger: 'blur' },
    { min: 20, message: 'TMDB API Key 长度不能少于20位', trigger: 'blur' }
  ],
  llmHost: [
    { required: true, message: 'Ollama 主机地址不能为空', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value && !isValidUrl(value)) {
          callback(new Error('请输入有效的URL地址'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  llmModel: [{ required: true, message: 'Ollama 模型名称不能为空', trigger: 'blur' }],
  openaiApiKey: [{ required: true, message: 'OpenAI API Key 不能为空', trigger: 'blur' }],
  openaiModel: [{ required: true, message: 'OpenAI 模型名称不能为空', trigger: 'blur' }],
  openaiBaseUrl: [
    { required: true, message: 'OpenAI Base URL 不能为空', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value && !isValidUrl(value)) {
          callback(new Error('请输入有效的URL地址'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  llmPrompt: [{ required: true, message: 'LLM 刮削提示不能为空', trigger: 'blur' }]
})

// URL验证函数
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// 获取配置
const getConfig = async () => {
  try {
    loading.value = true
    const config = await ConfigService.getConfig()
    
    // 更新表单数据
    Object.assign(configForm, config)
    // 备份原始数据
    Object.assign(originalConfig.value, config)
    
    console.log('获取配置成功:', config)
  } catch (error) {
    console.error('获取配置失败:', error)
    ElMessage.error('获取配置失败')
  } finally {
    loading.value = false
  }
}

// 处理LLM开关变化
const handleUseLlmChange = async (value: boolean) => {
  try {
    switchLoading.value = true
    
    // 如果关闭LLM，直接更新
    if (!value) {
      await updateConfig({ useLlm: value })
      ElMessage.success('已禁用LLM媒体刮削')
      return
    }
    
    // 如果开启LLM，检查必要配置
    if (value) {
      if (configForm.llmProvider === 'ollama' && (!configForm.llmHost || !configForm.llmModel)) {
        ElMessage.warning('请先配置Ollama主机地址和模型名称')
        return
      }
      if (configForm.llmProvider === 'openai' && (!configForm.openaiApiKey || !configForm.openaiModel)) {
        ElMessage.warning('请先配置OpenAI API Key和模型名称')
        return
      }
    }
    
    await updateConfig({ useLlm: value })
    ElMessage.success('已启用LLM媒体刮削')
  } catch (error) {
    console.error('更新LLM设置失败:', error)
    // 回滚开关状态
    configForm.useLlm = !value
  } finally {
    switchLoading.value = false
  }
}

// 更新配置
const updateConfig = async (params: UpdateConfigParams) => {
  const result = await ConfigService.updateConfig(params)
  // 更新本地数据
  Object.assign(configForm, result)
  Object.assign(originalConfig.value, result)
  return result
}

// 保存配置
const saveConfig = async () => {
  if (!configFormRef.value) return
  
  try {
    // 表单验证
    await configFormRef.value.validate()
    
    saveLoading.value = true
    
    // 检查是否有变更
    const hasChanges = Object.keys(configForm).some(key => {
      const k = key as keyof SystemConfig
      return configForm[k] !== originalConfig.value[k]
    })
    
    if (!hasChanges) {
      ElMessage.info('配置没有变更')
      return
    }
    
    // 确认保存
    await ElMessageBox.confirm(
      '确定要保存配置更改吗？',
      '确认保存',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 准备更新参数
    const updateParams: UpdateConfigParams = {}
    for (const key in configForm) {
      const k = key as keyof SystemConfig
      if (configForm[k] !== originalConfig.value[k]) {
        // @ts-expect-error: k is a valid key of updateParams
        updateParams[k] = configForm[k]
      }
    }
    
    // 更新配置
    await updateConfig(updateParams)
    ElMessage.success('配置保存成功')
  } catch (error: unknown) {
    if (error !== 'cancel') {
      console.error('保存配置失败:', error)
      ElMessage.error('保存配置失败')
    }
  } finally {
    saveLoading.value = false
  }
}

// 重置表单
const resetForm = () => {
  ElMessageBox.confirm(
    '确定要重置所有配置吗？这将恢复到上次保存的状态。',
    '确认重置',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    // 恢复到原始配置
    Object.assign(configForm, originalConfig.value)
    configFormRef.value?.clearValidate()
    ElMessage.success('配置已重置')
  }).catch(() => {
    // 用户取消重置
  })
}

// 组件挂载时获取配置
onMounted(() => {
  getConfig()
})
</script>

<template>
  <div class="config-view">
    <!-- 头部操作区 -->
    <div class="header-section">
      <div class="title-section">
        <h1 class="page-title">系统设置</h1>
        <p class="page-description">配置系统运行参数和服务设置</p>
      </div>
    </div>

    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <h2>TMDB 设置</h2>
          <p class="description">配置 The Movie Database (TMDB) API，用于获取媒体信息数据。</p>
        </div>
      </template>

      <el-form 
        ref="configFormRef" 
        :model="configForm" 
        :rules="configRules"
        label-width="140px"
        label-position="left"
        @submit.prevent
      >
        <el-form-item label="TMDB API Key" prop="tmdbApi">
          <el-input
            v-model="configForm.tmdbApi"
            placeholder="请输入您的 TMDB API Key"
            show-password
            clearable
          >
            <template #prefix>
              <el-icon><Document /></el-icon>
            </template>
          </el-input>
          <div class="form-item-help">
            <span class="help-text">
              获取API Key：访问 
              <el-link href="https://www.themoviedb.org/settings/api" target="_blank" type="primary">
                TMDB API 设置页面
              </el-link>
              申请免费的API密钥
            </span>
          </div>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <h2>LLM 设置</h2>
          <p class="description">配置用于媒体信息刮削的大语言模型服务。</p>
        </div>
      </template>

      <el-form 
        ref="configFormRef" 
        :model="configForm" 
        :rules="configRules"
        label-width="140px"
        label-position="left"
        @submit.prevent
      >
        <el-form-item label="LLM 媒体刮削" prop="useLlm">
          <div class="switch-item">
            <div class="switch-info">
              <span class="switch-label">启用后，系统将使用 LLM 自动识别并补充媒体信息。</span>
            </div>
            <el-switch
              v-model="configForm.useLlm"
              size="large"
              :loading="switchLoading"
              @change="handleUseLlmChange"
            />
          </div>
        </el-form-item>

        <el-form-item label="LLM 提供商" prop="llmProvider">
          <el-radio-group v-model="configForm.llmProvider" :disabled="!configForm.useLlm">
            <el-radio-button label="ollama">Ollama</el-radio-button>
            <el-radio-button label="openai">OpenAI</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <div v-if="configForm.llmProvider === 'ollama'">
          <el-form-item label="Ollama 主机" prop="llmHost">
            <el-input
              v-model="configForm.llmHost"
              placeholder="例如: http://127.0.0.1:11434"
              :disabled="!configForm.useLlm"
              clearable
            >
              <template #prefix>
                <el-icon><Link /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="Ollama 模型" prop="llmModel">
            <el-input
              v-model="configForm.llmModel"
              placeholder="例如: qwen2:7b"
              :disabled="!configForm.useLlm"
              clearable
            >
              <template #prefix>
                <el-icon><Cpu /></el-icon>
              </template>
            </el-input>
          </el-form-item>
        </div>

        <div v-if="configForm.llmProvider === 'openai'">
          <el-form-item label="OpenAI API Key" prop="openaiApiKey">
            <el-input
              v-model="configForm.openaiApiKey"
              placeholder="请输入您的 OpenAI API Key"
              :disabled="!configForm.useLlm"
              show-password
              clearable
            >
              <template #prefix>
                <el-icon><Document /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="OpenAI 模型" prop="openaiModel">
            <el-input
              v-model="configForm.openaiModel"
              placeholder="例如: gpt-4-turbo"
              :disabled="!configForm.useLlm"
              clearable
            >
              <template #prefix>
                <el-icon><Cpu /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="OpenAI Base URL" prop="openaiBaseUrl">
            <el-input
              v-model="configForm.openaiBaseUrl"
              placeholder="例如: https://api.openai.com/v1"
              :disabled="!configForm.useLlm"
              clearable
            >
              <template #prefix>
                <el-icon><Link /></el-icon>
              </template>
            </el-input>
          </el-form-item>
        </div>

        <el-form-item label="LLM 刮削提示" prop="llmPrompt">
          <el-input
            v-model="configForm.llmPrompt"
            type="textarea"
            :rows="10"
            placeholder="请输入 LLM 刮削提示词"
            :disabled="!configForm.useLlm"
            clearable
          >
            <template #prefix>
              <el-icon><Document /></el-icon>
            </template>
          </el-input>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <h2>日志设置</h2>
          <p class="description">配置系统日志的记录和存储方式。</p>
        </div>
      </template>

      <el-form 
        ref="configFormRef" 
        :model="configForm" 
        label-width="140px"
        label-position="left"
      >
        <el-form-item label="持久化日志" prop="persistentLogging">
          <div class="switch-item">
            <div class="switch-info">
              <span class="switch-label">启用后，系统会将日志保存到文件中，禁用则只在控制台输出。</span>
            </div>
            <el-switch
              v-model="configForm.persistentLogging"
              size="large"
            />
          </div>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="config-card action-card">
      <template #header>
        <div class="card-header">
          <h2>保存设置</h2>
          <p class="description">确认配置无误后，点击保存更改使配置生效。</p>
        </div>
      </template>

      <div class="operation-content">
        <div class="operation-info">
          <el-icon class="info-icon"><Document /></el-icon>
          <div class="info-text">
            <p class="info-title">配置提醒</p>
            <p class="info-description">配置更改后需要保存才能生效，重置将恢复到上次保存的状态。</p>
          </div>
        </div>
        <div class="action-buttons">
        <el-button @click="resetForm">重置</el-button>
        <el-button 
          type="primary" 
          :loading="saveLoading"
          @click="saveConfig"
        >
          <el-icon><Document /></el-icon>
          保存更改
        </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.config-view {
  padding: 24px;
  min-height: 100%;
  background-color: var(--color-background-soft);
}

/* 头部区域 */
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  background: var(--color-background);
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.title-section {
  flex: 1;
}

.page-title {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--color-heading);
}

.page-description {
  margin: 0;
  color: var(--color-text);
  font-size: 14px;
}

.config-card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  margin-bottom: 24px;
}

.config-card:last-child {
  margin-bottom: 0;
}

.card-header h2 {
  margin: 0 0 8px 0;
  color: var(--color-heading);
  font-size: 20px;
  font-weight: 600;
}

.description {
  margin: 0;
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.5;
}

.switch-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.switch-info {
  flex: 1;
}

.switch-label {
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.5;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.operation-content {
  padding: 16px 0;
}

.operation-info {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 24px;
  padding: 16px;
  background-color: var(--color-background-soft);
  border-radius: 8px;
  border-left: 4px solid var(--el-color-primary);
}

.info-icon {
  color: var(--el-color-primary);
  font-size: 20px;
  margin-top: 2px;
  flex-shrink: 0;
}

.info-text {
  flex: 1;
}

.info-title {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-heading);
}

.info-description {
  margin: 0;
  font-size: 13px;
  color: var(--color-text);
  line-height: 1.5;
}

:deep(.el-form-item__label) {
  color: var(--color-heading);
  font-weight: 500;
}

:deep(.el-input) {
  max-width: 400px;
}

:deep(.el-input__wrapper) {
  border-radius: 6px;
}

:deep(.el-input.is-disabled .el-input__wrapper) {
  background-color: var(--color-background-mute);
}

:deep(.el-switch.is-checked .el-switch__core) {
  background-color: var(--el-color-primary);
}

:deep(.el-button) {
  border-radius: 6px;
  font-weight: 500;
}

:deep(.el-button--primary) {
  background-color: var(--el-color-primary);
  border-color: var(--el-color-primary);
}

:deep(.el-button--primary:hover) {
  background-color: var(--el-color-primary-light-3);
  border-color: var(--el-color-primary-light-3);
}

.form-item-help {
  margin-left: 8px;
}

.help-text {
  font-size: 12px;
  color: var(--el-color-info);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .config-view {
    padding: 16px;
  }

  .header-section {
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }

  .page-title {
    font-size: 20px;
  }

  .config-card {
    padding: 16px;
    margin-bottom: 16px;
  }

  .operation-info {
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
    padding: 12px;
  }

  .info-icon {
    align-self: flex-start;
  }

  :deep(.el-form-item) {
    flex-direction: column;
  }

  :deep(.el-form-item__label) {
    width: 100% !important;
    text-align: left !important;
    line-height: normal !important;
    margin-bottom: 8px;
  }

  :deep(.el-form-item__content) {
    width: 100%;
    margin-left: 0 !important;
  }

  .switch-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .switch-info {
    margin-right: 0;
  }

  :deep(.el-input) {
    max-width: none;
  }

  .action-buttons {
    flex-direction: column-reverse;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
  }

  .action-buttons .el-button {
    width: 100%;
    margin-left: 0 !important;
  }

  .form-item-help {
    margin-left: 0px;
  }
}
</style>
