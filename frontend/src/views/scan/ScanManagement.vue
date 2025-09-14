<template>
  <div class="scan-management">
    <!-- 头部操作区 -->
    <div class="header-section">
      <div class="title-section">
        <h1 class="page-title">扫描管理</h1>
        <p class="page-description">管理媒体库扫描任务，查看扫描状态和处理结果</p>
      </div>
    </div>

    <!-- 扫描状态概览 -->
    <el-card class="scan-status-card">
      <template #header>
        <div class="card-header">
          <h2>扫描状态</h2>
          <p class="description">当前扫描任务的运行状态和统计信息</p>
          <el-button 
            type="primary"
            :loading="scanStatus.isScanning"
            :disabled="scanStatus.isScanning"
            @click="handleTriggerScan"
          >
            <el-icon><Refresh /></el-icon>
            {{ scanStatus.isScanning ? '扫描中...' : '立即扫描' }}
          </el-button>
        </div>
      </template>
      
      <div class="status-grid">
        <div class="status-item">
          <div class="status-value">{{ scanStatus.stats.total }}</div>
          <div class="status-label">总文件数</div>
        </div>
        <div class="status-item">
          <div class="status-value">{{ scanStatus.stats.videoCount }}</div>
          <div class="status-label">视频文件</div>
        </div>
        <div class="status-item">
          <div class="status-value">{{ scanStatus.stats.subtitleCount }}</div>
          <div class="status-label">字幕文件</div>
        </div>
        <div class="status-item">
          <div class="status-value">{{ scanStatus.stats.pending }}</div>
          <div class="status-label">待处理</div>
        </div>
        <div class="status-item">
          <div class="status-value">{{ scanStatus.stats.processed }}</div>
          <div class="status-label">已处理</div>
        </div>
        <div class="status-item error">
          <div class="status-value">{{ scanStatus.stats.error }}</div>
          <div class="status-label">错误</div>
        </div>
      </div>
    </el-card>

    <!-- 扫描配置 -->
    <el-card class="scan-config-card">
      <template #header>
        <div class="card-header">
          <div>
            <h2>扫描配置</h2>
            <p class="description">配置定期扫描的时间间隔和并发设置</p>
          </div>
          <el-button 
            type="primary" 
            :icon="Edit"
            @click="showConfigDialog"
          >
            配置扫描
          </el-button>
        </div>
      </template>
      
      <div class="config-grid">
        <div class="config-item">
          <div class="config-label">扫描状态</div>
          <div class="config-value">
            <el-tag :type="scanConfig.enabled ? 'success' : 'info'">
              {{ scanConfig.enabled ? '已启用' : '已禁用' }}
            </el-tag>
          </div>
        </div>
        <div class="config-item">
          <div class="config-label">扫描间隔</div>
          <div class="config-value">{{ formatInterval(scanConfig.interval) }}</div>
        </div>
        <div class="config-item">
          <div class="config-label">并发数量</div>
          <div class="config-value">{{ scanConfig.concurrency }}</div>
        </div>
      </div>
    </el-card>

    <!-- 扫描日志 -->
    <el-card class="scan-logs-section">
      <template #header>
        <div class="card-header">
          <h2>扫描日志</h2>
          <p class="description">查看最近的扫描日志和处理记录</p>
          <el-button @click="handleRefreshLogs">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>

      <el-table 
        :data="scanLogs.logs" 
        v-loading="logsLoading"
        empty-text="暂无扫描日志"
        stripe
        :default-sort="{ prop: 'scanTime', order: 'descending' }"
        @sort-change="handleSortChange"
      >
        <el-table-column 
          prop="scanTime" 
          label="扫描时间" 
          min-width="180"
          sortable="custom"
          :sort-orders="['descending', 'ascending']"
        >
          <template #default="{ row }">
            <div class="time-cell">
              <el-icon class="time-icon"><Clock /></el-icon>
              <span>{{ formatDateTime(row.scanTime) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="文件统计" min-width="200" align="center">
          <template #default="{ row }">
            <div class="stats-cell">
              <div class="stat-item">
                <span class="stat-label">发现:</span>
                <span class="stat-value">{{ row.filesFound }}</span>
              </div>
              <div class="stat-divider">|</div>
              <div class="stat-item">
                <span class="stat-label">新增:</span>
                <span class="stat-value highlight">{{ row.filesAdded }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column 
          prop="duration" 
          label="耗时" 
          width="100" 
          align="center"
          sortable="custom"
          :sort-orders="['descending', 'ascending']"
        >
          <template #default="{ row }">
            <el-tag type="info" effect="plain" size="small">
              {{ formatDuration(row.duration) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag 
              :type="row.status === 'success' ? 'success' : 'danger'"
              effect="dark"
              size="small"
            >
              <el-icon style="margin-right: 4px;">
                <Check v-if="row.status === 'success'" />
                <Close v-else />
              </el-icon>
              {{ row.status === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>

      <ResponsivePagination
        v-if="scanLogs.totalPages > 0"
        v-model:current-page="scanLogs.page"
        v-model:page-size="scanLogs.limit"
        :total="scanLogs.total"
        @current-change="handleLogsPageChange"
      />
    </el-card>

    <!-- 库文件管理 -->
    <el-card class="library-files-section">
      <template #header>
        <div class="card-header">
          <h2>库文件管理</h2>
          <p class="description">管理扫描发现的媒体文件和字幕文件</p>
          <div class="filters">
            <el-select 
              v-model="fileFilters.type" 
              placeholder="所有类型"
              clearable
              @change="handleRefreshFiles"
            >
              <el-option label="视频文件" value="video" />
              <el-option label="字幕文件" value="subtitle" />
            </el-select>
            <el-select 
              v-model="fileFilters.status" 
              placeholder="所有状态"
              clearable
              @change="handleRefreshFiles"
            >
              <el-option label="待处理" value="PENDING" />
              <el-option label="已处理" value="PROCESSED" />
              <el-option label="错误" value="ERROR" />
              <el-option label="忽略" value="IGNORED" />
            </el-select>
          </div>
        </div>
      </template>

      <el-table 
        :data="libraryFiles.files" 
        v-loading="filesLoading"
        empty-text="暂无库文件"
        stripe
      >
        <el-table-column prop="type" label="类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.type === 'video' ? 'primary' : 'success'">
              {{ row.type === 'video' ? '视频' : '字幕' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="path" label="文件路径" show-overflow-tooltip min-width="300" />
        <el-table-column prop="size" label="大小" width="120" align="center">
          <template #default="{ row }">
            {{ formatFileSize(row.size) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastProcessedAt" label="最后处理时间" width="200" align="center">
          <template #default="{ row }">
            {{ row.lastProcessedAt ? formatDateTime(row.lastProcessedAt) : '-' }}
          </template>
        </el-table-column>
      </el-table>

      <ResponsivePagination
        v-if="libraryFiles.totalPages > 0"
        v-model:current-page="libraryFiles.page"
        v-model:page-size="libraryFiles.limit"
        :total="libraryFiles.total"
        @current-change="handleFilesPageChange"
      />
    </el-card>

    <!-- 扫描配置对话框 -->
    <el-dialog 
      v-model="configDialogVisible"
      title="扫描配置"
      width="500px"
    >
      <el-form
        ref="configFormRef"
        :model="configForm"
        :rules="configRules"
        label-width="120px"
        label-position="left"
      >
        <el-form-item label="启用定期扫描">
          <el-switch
            v-model="configForm.enabled"
            size="large"
          />
        </el-form-item>

        <el-form-item label="扫描间隔" prop="interval">
          <el-select
            v-model="configForm.interval"
            :disabled="!configForm.enabled"
            placeholder="请选择扫描间隔"
            style="width: 200px"
          >
            <el-option label="每小时" :value="60" />
            <el-option label="每3小时" :value="180" />
            <el-option label="每6小时" :value="360" />
            <el-option label="每12小时" :value="720" />
            <el-option label="每天" :value="1440" />
            <el-option label="每周" :value="10080" />
          </el-select>
          <span v-if="configForm.enabled" class="interval-display">
            （{{ formatInterval(configForm.interval) }}）
          </span>
        </el-form-item>

        <el-form-item label="自定义间隔" prop="interval">
          <el-input-number
            v-model="configForm.interval"
            :min="1"
            :max="10080"
            :step="1"
            :disabled="!configForm.enabled"
            controls-position="right"
            style="width: 200px"
          />
          <span class="unit-text">分钟</span>
          <div class="form-item-help" style="margin-top: 8px;">
            <span class="help-text">
              最小间隔1分钟，最大间隔7天(10080分钟)
            </span>
          </div>
        </el-form-item>

        <el-form-item label="扫描并发数" prop="concurrency">
          <el-input-number
            v-model="configForm.concurrency"
            :min="1"
            :max="20"
            :disabled="!configForm.enabled"
            controls-position="right"
            style="width: 150px"
          />
          <div class="form-item-help" style="margin-left: 12px;">
            <span class="help-text">
              同时处理的文件数量，建议根据系统性能设置
            </span>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="configDialogVisible = false">取消</el-button>
          <el-button 
            type="primary" 
            :loading="configLoading"
            @click="updateScanConfig"
          >
            保存配置
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Refresh, Edit, Clock, Check, Close } from '@element-plus/icons-vue'
import { ScanService } from '@/api/scan'
import type { ScanConfig, ScanStatus, ScanLog, LibraryFile } from '@/api/scan/types'
import ResponsivePagination from '@/components/common/ResponsivePagination.vue'

// 加载状态
const logsLoading = ref(false)
const filesLoading = ref(false)
const configLoading = ref(false)

// 扫描配置
const scanConfig = ref<ScanConfig>({
  enabled: false,
  interval: 360,
  concurrency: 5
})

// 扫描配置表单
const configFormRef = ref<FormInstance>()
const configDialogVisible = ref(false)
const configForm = reactive({
  enabled: false,
  interval: 360,
  concurrency: 5
})

// 扫描配置验证规则
const configRules: FormRules = {
  interval: [
    { required: true, message: '扫描间隔不能为空', trigger: 'blur' },
    { type: 'number', min: 1, message: '扫描间隔不能少于1分钟', trigger: 'blur' }
  ],
  concurrency: [
    { required: true, message: '并发数不能为空', trigger: 'blur' },
    { type: 'number', min: 1, max: 20, message: '并发数必须在1-20之间', trigger: 'blur' }
  ]
}

// 扫描状态
const scanStatus = ref<ScanStatus>({
  isScanning: false,
  stats: {
    total: 0,
    videoCount: 0,
    subtitleCount: 0,
    pending: 0,
    processed: 0,
    error: 0,
    ignored: 0
  }
})

// 扫描日志
const scanLogs = ref({
  logs: [] as ScanLog[],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 0,
  sortBy: 'scanTime' as 'scanTime' | 'duration' | 'filesFound' | 'filesAdded',
  sortOrder: 'desc' as 'asc' | 'desc'
})

// 库文件
const libraryFiles = ref({
  files: [] as LibraryFile[],
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0
})

// 文件筛选
const fileFilters = reactive({
  type: '',
  status: ''
})

// 获取扫描状态
async function fetchScanStatus() {
  try {
    const data = await ScanService.getScanStatus()
    scanStatus.value = data
  } catch (error) {
    console.error('获取扫描状态失败:', error)
  }
}

// 获取扫描配置
async function fetchScanConfig() {
  try {
    const data = await ScanService.getScanConfig()
    scanConfig.value = data
  } catch (error) {
    console.error('获取扫描配置失败:', error)
  }
}

// 显示配置对话框
function showConfigDialog() {
  configDialogVisible.value = true
  Object.assign(configForm, scanConfig.value)
}

// 更新扫描配置
async function updateScanConfig() {
  if (!configFormRef.value) return

  const valid = await configFormRef.value.validate().catch(() => false)
  if (!valid) return

  configLoading.value = true
  try {
    const newConfig = await ScanService.updateScanConfig(configForm)
    scanConfig.value = newConfig
    
    ElMessage.success('扫描配置已更新')
    configDialogVisible.value = false
    
    // 刷新扫描状态
    setTimeout(() => {
      fetchScanStatus()
    }, 1000)
  } catch (error) {
    console.error('更新扫描配置失败:', error)
    ElMessage.error('更新扫描配置失败')
  } finally {
    configLoading.value = false
  }
}

// 格式化时间间隔显示
const formatInterval = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) {
    const remainingHours = hours % 24
    return remainingHours > 0 ? `${days}天${remainingHours}小时` : `${days}天`
  } else if (hours > 0) {
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}小时${remainingMinutes}分钟` : `${hours}小时`
  } else {
    return `${minutes}分钟`
  }
}

// 触发扫描
async function handleTriggerScan() {
  try {
    await ScanService.triggerScan()
    ElMessage.success('扫描已启动')
    // 刷新状态
    setTimeout(fetchScanStatus, 1000)
  } catch {
    ElMessage.error('触发扫描失败')
  }
}

// 获取扫描日志
async function fetchScanLogs() {
  try {
    logsLoading.value = true
    const data = await ScanService.getScanLogs({
      page: scanLogs.value.page,
      limit: scanLogs.value.limit,
      sortBy: scanLogs.value.sortBy,
      sortOrder: scanLogs.value.sortOrder
    })
    scanLogs.value = {
      ...scanLogs.value,
      logs: data.items,
      total: data.total,
      page: data.page,
      limit: data.limit,
      totalPages: data.totalPages
    }
  } catch (error) {
    console.error('获取扫描日志失败:', error)
    ElMessage.error('获取扫描日志失败')
  } finally {
    logsLoading.value = false
  }
}

// 获取库文件
async function fetchLibraryFiles() {
  try {
    filesLoading.value = true
    const data = await ScanService.getLibraryFiles({
      page: libraryFiles.value.page,
      limit: libraryFiles.value.limit,
      type: fileFilters.type || undefined,
      status: fileFilters.status || undefined
    })
    libraryFiles.value = {
      files: data.items,
      total: data.total,
      page: data.page,
      limit: data.limit,
      totalPages: data.totalPages
    }
  } catch (error) {
    console.error('获取库文件失败:', error)
    ElMessage.error('获取库文件失败')
  } finally {
    filesLoading.value = false
  }
}

// 刷新日志
function handleRefreshLogs() {
  fetchScanLogs()
}

// 刷新文件
function handleRefreshFiles() {
  libraryFiles.value.page = 1
  fetchLibraryFiles()
}

// 处理排序变化
function handleSortChange({ prop, order }: { prop: string; order: string | null }) {
  if (!prop) return
  
  // 映射Element Plus的排序方式到我们的格式
  const sortOrder = order === 'ascending' ? 'asc' : 'desc'
  
  // 更新排序参数
  scanLogs.value.sortBy = prop as 'scanTime' | 'duration' | 'filesFound' | 'filesAdded'
  scanLogs.value.sortOrder = sortOrder
  scanLogs.value.page = 1 // 重置到第一页
  
  // 重新获取数据
  fetchScanLogs()
}

// 切换日志页面
function handleLogsPageChange(page: number) {
  scanLogs.value.page = page
  fetchScanLogs()
}

// 切换文件页面
function handleFilesPageChange(page: number) {
  libraryFiles.value.page = page
  fetchLibraryFiles()
}

// 格式化日期时间
function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN')
}

// 格式化耗时
function formatDuration(ms: number) {
  if (ms < 1000) {
    return `${ms}ms`
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`
  } else {
    return `${(ms / 60000).toFixed(1)}min`
  }
}

// 格式化文件大小
function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 B'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

// 获取状态文本
function getStatusText(status: string) {
  const statusMap: Record<string, string> = {
    PENDING: '待处理',
    PROCESSED: '已处理',
    ERROR: '错误',
    IGNORED: '忽略'
  }
  return statusMap[status] || status
}

// 获取状态标签类型
function getStatusTagType(status: string) {
  const typeMap: Record<string, string> = {
    PENDING: 'warning',
    PROCESSED: 'success',
    ERROR: 'danger',
    IGNORED: 'info'
  }
  return typeMap[status] || 'info'
}

// 组件挂载时获取数据
onMounted(() => {
  fetchScanStatus()
  fetchScanConfig()
  fetchScanLogs()
  fetchLibraryFiles()
  
  // 每30秒刷新状态
  setInterval(fetchScanStatus, 30000)
})
</script>

<style scoped>
.scan-management {
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

/* 卡片样式 */
.scan-status-card,
.scan-config-card,
.scan-logs-section,
.library-files-section {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  margin-bottom: 24px;
}

.scan-status-card:last-child,
.scan-config-card:last-child,
.scan-logs-section:last-child,
.library-files-section:last-child {
  margin-bottom: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
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

/* 状态网格 */
.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 16px;
}

.status-item {
  text-align: center;
  padding: 20px 16px;
  background: var(--color-background);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.status-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.status-item.error {
  border-color: var(--el-color-danger-light-5);
  background: linear-gradient(135deg, 
    rgba(var(--el-color-danger-rgb), 0.05) 0%, 
    rgba(var(--el-color-danger-rgb), 0.02) 100%);
}

.status-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-heading);
  margin-bottom: 8px;
  line-height: 1;
}

.status-item.error .status-value {
  color: var(--el-color-danger);
}

.status-label {
  font-size: 14px;
  color: var(--color-text);
  font-weight: 500;
}

/* 配置网格 */
.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 16px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-label {
  font-size: 14px;
  color: var(--color-text);
  font-weight: 500;
}

.config-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-heading);
}

/* 筛选器 */
.filters {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .scan-management {
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

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .status-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .filters {
    flex-direction: column;
    width: 100%;
    align-items: stretch;
  }

  .filters .el-select {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .scan-management {
    padding: 12px;
  }

  .status-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .status-item {
    padding: 16px 12px;
  }

  .status-value {
    font-size: 24px;
  }
}

/* Element Plus 组件样式覆盖 */
:deep(.el-card__header) {
  padding: 20px 24px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

:deep(.el-card__body) {
  padding: 24px;
}

:deep(.el-table) {
  border-radius: 8px;
  overflow: hidden;
}

:deep(.el-table th.el-table__cell) {
  background-color: var(--color-background-mute);
  color: var(--color-heading);
  font-weight: 600;
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

:deep(.el-tag) {
  border-radius: 4px;
  font-weight: 500;
}

:deep(.el-select) {
  min-width: 120px;
}

:deep(.el-input__wrapper) {
  border-radius: 6px;
}

/* 表单样式 */
.form-item-help {
  margin-left: 8px;
}

.help-text {
  font-size: 12px;
  color: var(--el-color-info);
}

.interval-display {
  margin-left: 12px;
  color: var(--el-color-primary);
  font-size: 14px;
  font-weight: 500;
}

.unit-text {
  margin-left: 8px;
  color: var(--color-text);
  font-size: 14px;
}

.dialog-footer {
  text-align: right;
}

/* 扫描日志表格样式 */
.time-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-icon {
  color: var(--el-color-primary);
  font-size: 14px;
}

.stats-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 14px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-label {
  color: var(--color-text);
  font-size: 12px;
}

.stat-value {
  font-weight: 600;
  color: var(--color-heading);
  font-size: 14px;
}

.stat-value.highlight {
  color: var(--el-color-primary);
}

.stat-divider {
  color: var(--el-border-color);
  font-weight: 300;
}
</style>
