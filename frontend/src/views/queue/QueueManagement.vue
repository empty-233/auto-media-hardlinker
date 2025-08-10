<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox, type FormRules, type FormInstance } from 'element-plus'
import { Refresh, Edit, RefreshLeft, Delete } from '@element-plus/icons-vue'
import ResponsivePagination from '@/components/common/ResponsivePagination.vue'
import {
  QueueService,
  type QueueStatus,
  type QueueStats,
  type QueueConfig,
  type ScrapingTask,
  type TaskStatus
} from '@/api/queue'

// 定义组件名称
defineOptions({
  name: 'QueueManagement'
})

// 响应式数据
const loading = ref(false)
const tasksLoading = ref(false)
const queueStatus = ref<QueueStatus>()
const stats = ref<QueueStats>()
const config = ref<QueueConfig>()
const tasks = ref<ScrapingTask[]>([])

// 自动刷新相关
const autoRefresh = ref(false)
const refreshInterval = ref(10000) // 默认10秒
let refreshTimer: number | null = null

// 任务列表相关
const taskFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const totalTasks = ref(0)

// 配置编辑对话框
const configDialogVisible = ref(false)
const configLoading = ref(false)
const configFormRef = ref<FormInstance>()
const configForm = reactive({
  concurrency: 1,
  retryDelay: 1000,
  maxRetryDelay: 300000,
  defaultMaxRetries: 3,
  processingTimeout: 300000,
  batchSize: 10
})

const configRules: FormRules = {
  concurrency: [{ required: true, message: '请输入并发数', trigger: 'blur' }],
  retryDelay: [{ required: true, message: '请输入重试延迟', trigger: 'blur' }],
  maxRetryDelay: [{ required: true, message: '请输入最大重试延迟', trigger: 'blur' }],
  defaultMaxRetries: [{ required: true, message: '请输入默认最大重试次数', trigger: 'blur' }],
  processingTimeout: [{ required: true, message: '请输入处理超时时间', trigger: 'blur' }],
  batchSize: [{ required: true, message: '请输入批量大小', trigger: 'blur' }]
}

// 生命周期
onMounted(() => {
  refreshData()
})

// 方法
const refreshData = async () => {
  loading.value = true
  try {
    await Promise.all([loadStatus(), loadTasks()])
  } finally {
    loading.value = false
  }
}

const loadStatus = async () => {
  try {
    const status = await QueueService.getStatus()
    queueStatus.value = status
    stats.value = status.stats
    config.value = status.config
  } catch (error) {
    console.error('加载队列状态失败:', error)
    ElMessage.error('加载队列状态失败')
  }
}

const loadTasks = async () => {
  tasksLoading.value = true
  try {
    const response = await QueueService.getTasks({
      status: (taskFilter.value as TaskStatus) || undefined,
      page: currentPage.value,
      limit: pageSize.value,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    })
    tasks.value = response.items
    totalTasks.value = response.total
  } catch (error) {
    console.error('加载任务列表失败:', error)
    ElMessage.error('加载任务列表失败')
  } finally {
    tasksLoading.value = false
  }
}

// 自动刷新相关方法
const toggleAutoRefresh = (enabled: boolean) => {
  if (enabled) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

const startAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
  refreshTimer = setInterval(() => {
    refreshData()
  }, refreshInterval.value) as any
}

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

const updateRefreshInterval = () => {
  if (autoRefresh.value) {
    startAutoRefresh()
  }
}

// 组件销毁时清理定时器
onUnmounted(() => {
  stopAutoRefresh()
})

const showConfigDialog = () => {
  if (!config.value) return

  configDialogVisible.value = true
  Object.assign(configForm, config.value)
}

const updateConfig = async () => {
  if (!configFormRef.value) return

  const valid = await configFormRef.value.validate().catch(() => false)
  if (!valid) return

  configLoading.value = true
  try {
    const newConfig = await QueueService.updateConfig(configForm)
    config.value = newConfig
    ElMessage.success('配置更新成功')
    configDialogVisible.value = false
  } catch (error) {
    console.error('更新配置失败:', error)
    ElMessage.error('更新配置失败')
  } finally {
    configLoading.value = false
  }
}

const retryTask = async (taskId: number) => {
  try {
    await QueueService.retryTask(taskId)
    ElMessage.success('任务已重新加入队列')
    refreshData()
  } catch (error) {
    console.error('重试任务失败:', error)
    ElMessage.error('重试任务失败')
  }
}

const cancelTask = async (taskId: number) => {
  try {
    await ElMessageBox.confirm('确定要取消此任务吗？', '确认取消', {
      type: 'warning'
    })

    await QueueService.cancelTask(taskId)
    ElMessage.success('任务已取消')
    refreshData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('取消任务失败:', error)
      ElMessage.error('取消任务失败')
    }
  }
}

const retryAllFailedTasks = async () => {
  try {
    await ElMessageBox.confirm('确定要重试所有失败的任务吗？', '确认重试', {
      type: 'warning'
    })

    const result = await QueueService.retryAllFailedTasks()
    ElMessage.success(`已重试 ${result.retryCount} 个失败任务`)
    refreshData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('重试失败任务失败:', error)
      ElMessage.error('重试失败任务失败')
    }
  }
}

const clearFailedTasks = async () => {
  try {
    await ElMessageBox.confirm('确定要清除所有失败的任务吗？此操作不可撤销！', '确认清除', {
      type: 'warning'
    })

    const result = await QueueService.clearFailedTasks()
    ElMessage.success(`已清除 ${result.clearCount} 个失败任务`)
    refreshData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('清除失败任务失败:', error)
      ElMessage.error('清除失败任务失败')
    }
  }
}

// 工具方法
const getStatusTagType = (status: TaskStatus) => {
  const typeMap: Record<TaskStatus, '' | 'warning' | 'success' | 'danger' | 'info'> = {
    PENDING: '',
    RUNNING: 'warning',
    COMPLETED: 'success',
    FAILED: 'danger',
    CANCELED: 'info'
  }
  return typeMap[status] || ''
}

const getStatusText = (status: TaskStatus) => {
  const textMap: Record<TaskStatus, string> = {
    PENDING: '待处理',
    RUNNING: '处理中',
    COMPLETED: '已完成',
    FAILED: '失败',
    CANCELED: '已取消'
  }
  return textMap[status] || status
}

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatProcessingTime = (time?: number) => {
  if (time === null || typeof time === 'undefined') return '-'
  if (time < 1000) return `${time.toFixed(0)}ms`
  return `${(time / 1000).toFixed(2)}s`
}

const formatTimeout = (time?: number) => {
  if (!time) return '-'
  return `${Math.round(time / 1000)}s`
}
</script>

<template>
  <div class="queue-management-view">
    <!-- 头部操作区 -->
    <div class="header-section">
      <div class="title-section">
        <h1 class="page-title">队列管理</h1>
        <p class="page-description">监控和管理后台任务处理队列</p>
      </div>
      <div class="actions-section">
        <el-button type="primary" @click="refreshData" :loading="loading" :icon="Refresh">
          刷新
        </el-button>
      </div>
    </div>

    <!-- 状态与配置 -->
    <div class="status-config-grid">
      <!-- 队列状态卡片 -->
      <div class="status-cards-container">
        <div class="status-header">
          <div class="status-title">
            <h3>运行状态</h3>
            <div class="status-indicator" :class="{ active: queueStatus?.running }">
              {{ queueStatus?.running ? '运行中' : '已停止' }}
            </div>
          </div>
        </div>
        <div class="status-cards-grid">
          <div class="status-item">
            <div class="status-value">{{ stats?.pending || 0 }}</div>
            <div class="status-label">待处理</div>
          </div>
          <div class="status-item">
            <div class="status-value">{{ stats?.running || 0 }}</div>
            <div class="status-label">处理中</div>
          </div>
          <div class="status-item">
            <div class="status-value">{{ stats?.completed || 0 }}</div>
            <div class="status-label">已完成</div>
          </div>
          <div class="status-item">
            <div class="status-value failed">{{ stats?.failed || 0 }}</div>
            <div class="status-label">失败</div>
          </div>
          <div class="status-item">
            <div class="status-value">{{ stats?.canceled || 0 }}</div>
            <div class="status-label">已取消</div>
          </div>
          <div class="status-item">
            <div class="status-value">{{ formatProcessingTime(stats?.averageProcessingTime) }}</div>
            <div class="status-label">平均耗时</div>
          </div>
        </div>
      </div>

      <!-- 配置面板 -->
      <div class="config-panel">
        <div class="config-header">
          <h3>队列配置</h3>
          <el-button size="small" @click="showConfigDialog" :icon="Edit" text type="primary">编辑</el-button>
        </div>
        <div class="config-grid">
          <div class="config-item">
            <span class="config-label">并发数:</span>
            <span class="config-value">{{ config?.concurrency }}</span>
          </div>
          <div class="config-item">
            <span class="config-label">重试延迟:</span>
            <span class="config-value">{{ config?.retryDelay }}ms</span>
          </div>
          <div class="config-item">
            <span class="config-label">最大重试:</span>
            <span class="config-value">{{ config?.defaultMaxRetries }}</span>
          </div>
          <div class="config-item">
            <span class="config-label">处理超时:</span>
            <span class="config-value">{{ formatTimeout(config?.processingTimeout) }}</span>
          </div>
        </div>
        <div class="auto-refresh-control">
          <span class="config-label">自动刷新</span>
          <div class="switch-select-group">
            <el-switch v-model="autoRefresh" @change="toggleAutoRefresh" />
            <el-select
              v-model="refreshInterval"
              @change="updateRefreshInterval"
              style="width: 80px"
              size="small"
              :disabled="!autoRefresh"
            >
              <el-option label="5s" :value="5000" />
              <el-option label="10s" :value="10000" />
              <el-option label="30s" :value="30000" />
              <el-option label="60s" :value="60000" />
            </el-select>
          </div>
        </div>
      </div>
    </div>

    <!-- 过滤器区域 -->
    <div class="filter-section">
      <div class="filter-item">
        <span class="filter-label">任务状态</span>
        <el-select v-model="taskFilter" placeholder="全部" clearable @change="loadTasks" style="width: 120px">
          <el-option label="全部" value="" />
          <el-option label="待处理" value="PENDING" />
          <el-option label="处理中" value="RUNNING" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="失败" value="FAILED" />
        </el-select>
      </div>
      <div class="filter-actions">
        <el-button type="warning" @click="retryAllFailedTasks" :disabled="!stats?.failed" :icon="RefreshLeft">
          重试失败任务
        </el-button>
        <el-button type="danger" @click="clearFailedTasks" :disabled="!stats?.failed" :icon="Delete">
          清除失败任务
        </el-button>
      </div>
    </div>

    <!-- 任务列表 -->
    <div class="table-container">
      <el-table :data="tasks" v-loading="tasksLoading" row-key="id" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="fileName" label="文件名" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="80" />
        <el-table-column label="重试" width="80">
          <template #default="{ row }">
            <span>{{ row.retryCount }}/{{ row.maxRetries }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="错误信息" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.lastError" class="error-text">{{ row.lastError }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'FAILED'"
              size="small"
              type="primary"
              @click="retryTask(row.id)"
              text
            >
              重试
            </el-button>
            <el-button
              v-if="row.status === 'PENDING'"
              size="small"
              type="danger"
              @click="cancelTask(row.id)"
              text
            >
              取消
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <ResponsivePagination
      v-if="totalTasks > 0"
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :total="totalTasks"
      :page-sizes="[20, 50, 100]"
      @change="loadTasks"
    />

    <!-- 配置编辑对话框 -->
    <el-dialog v-model="configDialogVisible" title="编辑队列配置" width="clamp(320px, 90%, 800px)" class="config-dialog" top="5vh">
      <el-form :model="configForm" :rules="configRules" ref="configFormRef" label-position="top">
        <div class="config-section">
          <h4 class="section-title">基础配置</h4>
          <el-row :gutter="20">
            <el-col :xs="24" :sm="12">
              <el-form-item label="并发数" prop="concurrency">
                <el-input-number v-model="configForm.concurrency" :min="1" :max="10" style="width: 100%" />
                <p class="form-item-description">同时处理的任务数量</p>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="批量大小" prop="batchSize">
                <el-input-number v-model="configForm.batchSize" :min="1" :max="100" style="width: 100%" />
                <p class="form-item-description">每次处理的文件数量</p>
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <div class="config-section">
          <h4 class="section-title">重试配置</h4>
          <el-row :gutter="20">
            <el-col :xs="24" :sm="12">
              <el-form-item label="重试延迟" prop="retryDelay">
                <el-input-number v-model="configForm.retryDelay" :min="100" :step="100" style="width: 100%" />
                <p class="form-item-description">任务失败后的初始等待时间 (ms)</p>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="最大重试延迟" prop="maxRetryDelay">
                <el-input-number v-model="configForm.maxRetryDelay" :min="1000" :step="1000" style="width: 100%" />
                <p class="form-item-description">任务失败后最长的等待时间 (ms)</p>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row>
            <el-col :xs="24">
              <el-form-item label="默认最大重试次数" prop="defaultMaxRetries">
                <el-input-number v-model="configForm.defaultMaxRetries" :min="1" :max="10" style="width: 100%" />
                <p class="form-item-description">失败后的最大重试次数</p>
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <div class="config-section">
          <h4 class="section-title">超时配置</h4>
          <el-row>
            <el-col :xs="24">
              <el-form-item label="处理超时" prop="processingTimeout">
                <el-input-number
                  v-model="configForm.processingTimeout"
                  :min="10000"
                  :step="10000"
                  style="width: 100%"
                />
                <p class="form-item-description">单个任务的最大处理时间 (ms)</p>
              </el-form-item>
            </el-col>
          </el-row>
        </div>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="configDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="updateConfig" :loading="configLoading">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.queue-management-view {
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

.actions-section {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* 状态与配置网格 */
.status-config-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

/* 状态卡片 */
.status-cards-container {
  background: white;
  padding: 20px 24px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.status-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-title h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.status-indicator {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
  background-color: #f0f2f5;
  color: #909399;
}

.status-indicator.active {
  background-color: #e6f7f2;
  color: #00a854;
}

.status-cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.status-item {
  text-align: center;
}

.status-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 4px;
}

.status-value.failed {
  color: #f56c6c;
}

.status-label {
  color: #909399;
  font-size: 14px;
}

/* 配置面板 */
.config-panel {
  background: white;
  padding: 20px 24px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.config-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-label {
  font-size: 14px;
  color: #909399;
}

.config-value {
  font-size: 16px;
  font-weight: 500;
  color: #606266;
}

.auto-refresh-control {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid #f0f2f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.switch-select-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 过滤器区域 */
.filter-section {
  background: white;
  padding: 20px 24px;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 14px;
  color: #606266;
}

.filter-actions {
  margin-left: auto;
  display: flex;
  gap: 12px;
}

/* 表格容器 */
.table-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.error-text {
  color: #f56c6c;
}


.form-item-description {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.4;
}

.config-section {
  margin-bottom: 12px;
  padding: 16px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background-color: #fafafa;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #303133;
}

.dialog-footer {
  text-align: right;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .status-config-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .queue-management-view {
    padding: 16px;
  }

  .header-section {
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }

  .status-cards-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .filter-section {
    flex-direction: column;
    align-items: stretch;
    padding: 16px;
  }

  .filter-actions {
    margin-left: 0;
    margin-top: 16px;
    justify-content: flex-end;
  }

  .config-dialog .el-dialog__body {
    padding: 12px;
  }

  .config-section {
    padding: 12px;
  }
}
</style>
