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
  llmHost: '',
  llmModel: ''
})

// 原始数据备份
const originalConfig = ref<SystemConfig>({
  useLlm: false,
  llmHost: '',
  llmModel: ''
})

// 表单验证规则
const configRules: FormRules = {
  llmHost: [
    {
      validator: (rule, value, callback) => {
        if (configForm.useLlm && !value) {
          callback(new Error('启用LLM时，主机地址不能为空'))
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
        if (configForm.useLlm && !value) {
          callback(new Error('启用LLM时，模型名称不能为空'))
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
    if (value && (!configForm.llmHost || !configForm.llmModel)) {
      ElMessage.warning('请先配置LLM主机地址和模型名称')
      // 不直接更新开关状态，让用户先配置完整信息
      return
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
    const hasChanges = 
      configForm.useLlm !== originalConfig.value.useLlm ||
      configForm.llmHost !== originalConfig.value.llmHost ||
      configForm.llmModel !== originalConfig.value.llmModel
    
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

    if (configForm.useLlm !== originalConfig.value.useLlm) {
      updateParams.useLlm = configForm.useLlm
    }
    if (configForm.llmHost !== originalConfig.value.llmHost) {
      updateParams.llmHost = configForm.llmHost
    }
    if (configForm.llmModel !== originalConfig.value.llmModel) {
      updateParams.llmModel = configForm.llmModel
    }
    
    // 更新配置
    await updateConfig(updateParams)
    ElMessage.success('配置保存成功')
  } catch (error: any) {
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

        <el-form-item label="LLM 主机" prop="llmHost">
          <el-input
            v-model="configForm.llmHost"
            placeholder="http://192.168.50.202:11434"
            :disabled="!configForm.useLlm"
            clearable
          >
            <template #prefix>
              <el-icon><Link /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="LLM 模型" prop="llmModel">
          <el-input
            v-model="configForm.llmModel"
            placeholder="qwen2:7b"
            :disabled="!configForm.useLlm"
            clearable
          >
            <template #prefix>
              <el-icon><Cpu /></el-icon>
            </template>
          </el-input>
        </el-form-item>
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
  }
  
  .page-title {
    font-size: 20px;
  }
  
  .switch-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  :deep(.el-form-item__label) {
    width: 100% !important;
    text-align: left !important;
  }
  
  :deep(.el-input) {
    max-width: none;
  }
  
  .action-buttons {
    flex-direction: column-reverse;
  }
  
  .action-buttons .el-button {
    width: 100%;
  }
}
</style>
