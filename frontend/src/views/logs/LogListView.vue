<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Clock, CopyDocument } from '@element-plus/icons-vue'
import { useDebounceFn } from '@vueuse/core'
import { LogService } from '@/api/logs'
import type { LogEntry } from '@/api/logs/types'

// 定义组件名称以支持 keep-alive
defineOptions({
  name: 'LogListView',
})

// 响应式数据
const loading = ref(false)
const logList = ref<LogEntry[]>([])
const searchKeyword = ref('')
const selectedLevel = ref('')
const currentPage = ref(1)
const pageSize = 50
const sortConfig = ref<{ prop: string; order: string }>({ prop: 'timestamp', order: 'descending' })

// 对话框相关
const detailDialogVisible = ref(false)
const selectedLog = ref<LogEntry | null>(null)

// 计算属性
const filteredLogList = computed(() => {
  let result = logList.value

  // 后端已支持关键词和级别过滤，无需前端过滤

  // 排序
  if (sortConfig.value.prop) {
    result.sort((a, b) => {
      let aValue = getValueByPath(a, sortConfig.value.prop)
      let bValue = getValueByPath(b, sortConfig.value.prop)

      // 特殊处理时间戳
      if (sortConfig.value.prop === 'timestamp') {
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
      }

      if (sortConfig.value.order === 'ascending') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })
  }

  return result
})

const displayedLogList = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return filteredLogList.value.slice(start, end)
})

// 检查是否有激活的过滤器
const hasActiveFilters = computed(() => {
  return !!(selectedLevel.value || searchKeyword.value)
})

// 方法
const loadLogList = async () => {
  try {
    loading.value = true

    // 构建查询参数
    const params: any = { limit: 1000 }

    if (selectedLevel.value) {
      params.level = selectedLevel.value
    }
    if (searchKeyword.value.trim()) {
      params.keyword = searchKeyword.value.trim()
    }

    logList.value = await LogService.getLogs(params)
  } catch (error) {
    console.error('加载日志列表失败:', error)
    ElMessage.error('加载日志列表失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

const refreshData = () => {
  currentPage.value = 1
  loadLogList()
}

// 防抖搜索
const handleSearch = useDebounceFn(() => {
  currentPage.value = 1
  loadLogList()
}, 300)

const handleLevelChange = () => {
  currentPage.value = 1
  loadLogList() // 重新从后端加载数据
}

const resetFilters = () => {
  selectedLevel.value = ''
  searchKeyword.value = ''
  currentPage.value = 1
  loadLogList()
}

const clearLevelFilter = () => {
  selectedLevel.value = ''
  currentPage.value = 1
  loadLogList()
}

const clearSearchFilter = () => {
  searchKeyword.value = ''
  currentPage.value = 1
  loadLogList()
}

const handlePageChange = (page: number) => {
  currentPage.value = page
}

const handleSortChange = ({ prop, order }: { prop: string; order: string }) => {
  sortConfig.value = { prop, order }
}

const showLogDetails = (log: LogEntry) => {
  selectedLog.value = log
  detailDialogVisible.value = true
}

const handleDialogClose = () => {
  selectedLog.value = null
}

const copyLogContent = (log: LogEntry | null) => {
  if (!log) return

  const content = `[${getLogLevelText(log.level)}] ${formatDate(log.timestamp)} - ${log.message}`
  navigator.clipboard
    .writeText(content)
    .then(() => {
      ElMessage.success('日志内容已复制到剪贴板')
    })
    .catch(() => {
      ElMessage.error('复制失败，请手动复制')
    })
}

// 工具函数
const getLogLevelText = (level: string): string => {
  switch (level) {
    case 'INFO':
      return 'INFO'
    case 'WARNING':
      return 'WARNING'
    case 'ERROR':
      return 'ERROR'
    case 'DEBUG':
      return 'DEBUG'
    default:
      return level
  }
}

const getLogLevelTagType = (level: string): string => {
  switch (level) {
    case 'INFO':
      return 'info'
    case 'WARNING':
      return 'warning'
    case 'ERROR':
      return 'danger'
    case 'DEBUG':
      return 'success'
    default:
      return 'info'
  }
}

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return dateString
  }
}

const getValueByPath = (obj: any, path: string): any => {
  return path.split('.').reduce((o, p) => o?.[p], obj)
}

// 生命周期
onMounted(() => {
  loadLogList()
})
</script>

<template>
  <div class="log-list-view">
    <!-- 头部操作区 -->
    <div class="header-section">
      <div class="title-section">
        <h1 class="page-title">系统日志</h1>
        <p class="page-description">查看系统运行日志和错误信息（运行时1000条）</p>
      </div>
    </div>

    <!-- 过滤器区域 -->
    <div class="filter-section">
      <div class="filter-item">
        <span class="filter-label">日志级别</span>
        <el-select
          v-model="selectedLevel"
          placeholder="全部"
          clearable
          @change="handleLevelChange"
          style="width: 120px"
        >
          <el-option value="" label="全部" />
          <el-option value="INFO" label="INFO" />
          <el-option value="WARNING" label="WARNING" />
          <el-option value="ERROR" label="ERROR" />
          <el-option value="DEBUG" label="DEBUG" />
        </el-select>
      </div>

      <div class="filter-item">
        <span class="filter-label">关键词搜索</span>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索日志内容..."
          :prefix-icon="Search"
          clearable
          class="search-input-sm"
          @input="handleSearch"
        />
      </div>

      <div class="filter-actions">
        <el-button @click="resetFilters" :icon="Refresh"> 重置过滤器 </el-button>
      </div>
    </div>

    <!-- 过滤器状态 -->
    <div v-if="hasActiveFilters" class="filter-status">
      <span class="status-text">当前过滤条件：</span>
      <el-tag v-if="selectedLevel" type="info" closable @close="clearLevelFilter">
        级别: {{ getLogLevelText(selectedLevel) }}
      </el-tag>
      <el-tag v-if="searchKeyword" type="info" closable @close="clearSearchFilter">
        关键词: {{ searchKeyword }}
      </el-tag>
    </div>
    <div v-if="loading && logList.length === 0" class="loading-container">
      <el-skeleton :rows="8" animated />
    </div>

    <!-- 空状态 -->
    <el-empty
      v-else-if="!loading && filteredLogList.length === 0"
      description="暂无日志记录"
      class="empty-state"
    >
      <el-button type="primary" @click="refreshData">刷新数据</el-button>
    </el-empty>

    <!-- 日志表格 -->
    <div v-else class="table-container">
      <el-table
        :data="displayedLogList"
        style="width: 100%"
        stripe
        :default-sort="{ prop: 'timestamp', order: 'descending' }"
        @sort-change="handleSortChange"
      >
        <el-table-column prop="level" label="级别" width="80" sortable>
          <template #default="{ row }">
            <el-tag :type="getLogLevelTagType(row.level)" size="small" class="log-level-tag">
              {{ getLogLevelText(row.level) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="timestamp" label="时间" width="180" sortable>
          <template #default="{ row }">
            <div class="timestamp">
              <el-icon class="time-icon"><Clock /></el-icon>
              <span>{{ formatDate(row.timestamp) }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="message" label="内容" min-width="400">
          <template #default="{ row }">
            <div class="log-message">
              <div class="message-content" :title="row.message">
                {{ row.message }}
              </div>
              <div v-if="row.details" class="message-details">
                <el-button
                  type="text"
                  size="small"
                  @click="showLogDetails(row)"
                  class="details-btn"
                >
                  查看详情
                </el-button>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              @click="copyLogContent(row)"
              :icon="CopyDocument"
            >
              复制
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <div v-if="filteredLogList.length > pageSize" class="pagination-container">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="filteredLogList.length"
        layout="total, prev, pager, next, jumper"
        @current-change="handlePageChange"
      />
    </div>

    <!-- 日志详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="日志详情"
      width="60%"
      :before-close="handleDialogClose"
    >
      <div v-if="selectedLog" class="log-detail">
        <div class="detail-row">
          <span class="detail-label">级别：</span>
          <el-tag :type="getLogLevelTagType(selectedLog.level)" size="small">
            {{ getLogLevelText(selectedLog.level) }}
          </el-tag>
        </div>
        <div class="detail-row">
          <span class="detail-label">时间：</span>
          <span>{{ formatDate(selectedLog.timestamp) }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">内容：</span>
          <div class="detail-content">{{ selectedLog.message }}</div>
        </div>
        <div v-if="selectedLog.details" class="detail-row">
          <span class="detail-label">详细信息：</span>
          <pre class="detail-json">{{ JSON.stringify(selectedLog.details, null, 2) }}</pre>
        </div>
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="copyLogContent(selectedLog)"> 复制日志 </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.log-list-view {
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

.search-input {
  width: 280px;
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
  min-width: 60px;
}

.search-input-sm {
  width: 200px;
}

.filter-actions {
  margin-left: auto;
}

/* 过滤器状态 */
.filter-status {
  background: white;
  padding: 16px 24px;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.status-text {
  color: #606266;
  font-size: 14px;
  font-weight: 500;
}

/* 表格容器 */
.table-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

/* 日志级别标签 */
.log-level-tag {
  font-weight: 500;
  min-width: 50px;
  text-align: center;
}

/* 时间戳 */
.timestamp {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #606266;
  font-size: 12px;
  font-family: monospace;
}

.time-icon {
  font-size: 14px;
  color: #909399;
}

/* 日志消息 */
.log-message {
  display: flex;
  align-items: center;
  gap: 12px;
}

.message-content {
  flex: 1;
  color: #303133;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.message-details {
  flex-shrink: 0;
}

.details-btn {
  padding: 0;
  font-size: 12px;
  color: #409eff;
}

/* 分页 */
.pagination-container {
  display: flex;
  justify-content: center;
  padding: 24px;
  background: white;
  border-radius: 8px;
  margin-top: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 加载和空状态 */
.loading-container {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.empty-state {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 60px 24px;
}

/* 日志详情对话框 */
.log-detail {
  padding: 16px 0;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 16px;
}

.detail-label {
  font-weight: 500;
  color: #303133;
  min-width: 80px;
  flex-shrink: 0;
}

.detail-content {
  flex: 1;
  color: #606266;
  line-height: 1.6;
  word-break: break-word;
}

.detail-json {
  flex: 1;
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  color: #606266;
  line-height: 1.4;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header-section {
    flex-direction: column;
    gap: 16px;
  }

  .actions-section {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .search-input {
    width: 100%;
  }

  .filter-section {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-item {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }

  .filter-label {
    min-width: auto;
  }

  .filter-actions {
    margin-left: 0;
    margin-top: 16px;
  }

  .search-input-sm {
    width: 100%;
  }

  .log-list-view {
    padding: 16px;
  }

  .log-message {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
}
</style>
