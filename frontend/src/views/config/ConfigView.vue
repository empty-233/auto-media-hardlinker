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
  useLlm: false,
  llmProvider: 'ollama',
  llmHost: '',
  llmModel: '',
  openaiApiKey: '',
  openaiModel: '',
  openaiBaseUrl: ''
})

// 原始数据备份
const originalConfig = ref<SystemConfig>({
  useLlm: false,
  llmProvider: 'ollama',
  llmHost: '',
  llmModel: '',
  openaiApiKey: '',
  openaiModel: '',
  openaiBaseUrl: ''
})

// 表单验证规则
const configRules: FormRules = {
  llmHost: [
    {
      validator: (rule, value, callback) => {
        if (configForm.useLlm && configForm.llmProvider === 'ollama' && !value) {
          callback(new Error('Ollama 主机地址不能为空'))
        } else if (value && !isValidUrl(value)) {
          callback(new Error('请输入有效的URL地址'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  llmModel: [
    {
      validator: (rule, value, callback) => {
        if (configForm.useLlm && configForm.llmProvider === 'ollama' && !value) {
          callback(new Error('Ollama 模型名称不能为空'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  openaiApiKey: [
    {
      validator: (rule, value, callback) => {
        if (configForm.useLlm && configForm.llmProvider === 'openai' && !value) {
          callback(new Error('OpenAI API Key 不能为空'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  openaiModel: [
    {
      validator: (rule, value, callback) => {
        if (configForm.useLlm && configForm.llmProvider === 'openai' && !value) {
          callback(new Error('OpenAI 模型名称不能为空'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  openaiBaseUrl: [
    {
      validator: (rule, value, callback) => {
        if (configForm.useLlm && configForm.llmProvider === 'openai' && !value) {
          callback(new Error('OpenAI Base URL 不能为空'))
        } else if (value && !isValidUrl(value)) {
          callback(new Error('请输入有效的URL地址'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

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
      </el-form>

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
    </el-card>
  </div>
</template>

<style scoped>
.config-view {
  padding: 24px;
  min-height: 100%;
  background-color: #f5f7fa;
}

/* 头部区域 */
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  background: white;
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
  color: #303133;
}

.page-description {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.config-card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}

.card-header h2 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 20px;
  font-weight: 600;
}

.description {
  margin: 0;
  color: #909399;
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
  color: #606266;
  font-size: 14px;
  line-height: 1.5;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #f0f0f0;
}

:deep(.el-form-item__label) {
  color: #303133;
  font-weight: 500;
}

:deep(.el-input) {
  max-width: 400px;
}

:deep(.el-input__wrapper) {
  border-radius: 6px;
}

:deep(.el-input.is-disabled .el-input__wrapper) {
  background-color: #f5f7fa;
}

:deep(.el-switch.is-checked .el-switch__core) {
  background-color: #409eff;
}

:deep(.el-button) {
  border-radius: 6px;
  font-weight: 500;
}

:deep(.el-button--primary) {
  background-color: #409eff;
  border-color: #409eff;
}

:deep(.el-button--primary:hover) {
  background-color: #66b1ff;
  border-color: #66b1ff;
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
}
</style>
