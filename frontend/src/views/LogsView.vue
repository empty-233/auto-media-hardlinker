<template>
  <div class="logs-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <h2>系统日志</h2>
          <div class="filter-actions">
            <el-select v-model="logLevel" clearable placeholder="日志级别" @change="filterLogs">
              <el-option
                v-for="level in logLevels"
                :key="level"
                :label="level"
                :value="level"
              />
            </el-select>
            <el-button type="primary" @click="refreshLogs">
              <el-icon><el-icon-refresh /></el-icon>
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <div v-loading="loading">
        <el-table :data="logs" style="width: 100%">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="timestamp" label="时间" width="180">
            <template #default="scope">
              {{ formatDateTime(scope.row.timestamp) }}
            </template>
          </el-table-column>
          <el-table-column prop="level" label="级别" width="100">
            <template #default="scope">
              <el-tag :type="getLogLevelType(scope.row.level)" size="small">
                {{ scope.row.level }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="message" label="内容" min-width="300" />
        </el-table>

        <div v-if="logs.length === 0 && !loading" class="no-data">
          <el-empty description="暂无日志" />
        </div>

        <div class="actions-footer">
          <el-button @click="loadMoreLogs" :disabled="loading || !hasMoreLogs">
            加载更多
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Refresh as ElIconRefresh } from '@element-plus/icons-vue'
import { api, LogEntry } from '../api'

const loading = ref(false)
const logs = ref<LogEntry[]>([])
const logLevel = ref('')
const logLimit = ref(100)
const hasMoreLogs = ref(true)

const logLevels = ['INFO', 'WARNING', 'ERROR', 'DEBUG']

// 获取日志级别对应的标签类型
const getLogLevelType = (level: string) => {
  const types: Record<string, string> = {
    'INFO': 'info',
    'WARNING': 'warning',
    'ERROR': 'danger',
    'DEBUG': 'success'
  }
  return types[level] || 'info'
}

// 格式化日期时间
const formatDateTime = (dateString: string) => {
  if (!dateString) return '未知'
  const date = new Date(dateString)
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }
  
  return date.toLocaleString('zh-CN', options)
}

// 按级别过滤日志
const filterLogs = async () => {
  loading.value = true
  try {
    const response = await api.getLogs(logLimit.value)
    if (logLevel.value) {
      logs.value = response.data.filter(log => log.level === logLevel.value)
    } else {
      logs.value = response.data
    }
    hasMoreLogs.value = response.data.length === logLimit.value
  } catch (error) {
    console.error('获取日志失败:', error)
  } finally {
    loading.value = false
  }
}

// 刷新日志
const refreshLogs = async () => {
  loading.value = true
  try {
    const response = await api.getLogs(logLimit.value)
    logs.value = response.data
    hasMoreLogs.value = response.data.length === logLimit.value
  } catch (error) {
    console.error('获取日志失败:', error)
  } finally {
    loading.value = false
  }
}

// 加载更多日志
const loadMoreLogs = async () => {
  if (loading.value || !hasMoreLogs.value) return
  
  loading.value = true
  try {
    logLimit.value += 100
    const response = await api.getLogs(logLimit.value)
    logs.value = response.data
    hasMoreLogs.value = response.data.length === logLimit.value
  } catch (error) {
    console.error('加载更多日志失败:', error)
  } finally {
    loading.value = false
  }
}

// 初始加载
onMounted(async () => {
  loading.value = true
  try {
    const response = await api.getLogs(logLimit.value)
    logs.value = response.data
    hasMoreLogs.value = response.data.length === logLimit.value
  } catch (error) {
    console.error('获取日志失败:', error)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.logs-view {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
}

.filter-actions {
  display: flex;
  gap: 10px;
}

.actions-footer {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.no-data {
  padding: 40px 0;
}
</style>