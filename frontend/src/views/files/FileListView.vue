<script setup lang="ts">
import { ref, computed, onMounted, watch, onActivated } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import {
  Search,
  Refresh,
  House,
  View,
  Document,
  VideoCamera,
  Picture,
  Film,
  Folder,
  Check,
  Close,
  Warning,
  ArrowLeft,
  ArrowRight,
} from '@element-plus/icons-vue'
import { FileService, type DirectoryResponse } from '@/api/files'
import type { FileSystemItem } from '@/api/files/types'
import FileDetailDialog from './components/FileDetailDialog.vue'

// 定义组件名称以支持 keep-alive
defineOptions({
  name: 'FileListView',
})

// 路由
const route = useRoute()
const router = useRouter()

// 响应式数据
const loading = ref(false)
const fileList = ref<FileSystemItem[]>([])
const currentPath = ref('')
const parentPath = ref<string | null>(null)
const searchKeyword = ref('')
const sortConfig = ref<{ prop: string; order: string }>({ prop: 'name', order: 'ascending' })
const detailDialogVisible = ref(false)
const selectedFile = ref<FileSystemItem | null>(null)
const viewMode = ref<'grid' | 'list'>('grid')
const filterType = ref<'all' | 'inDb' | 'notInDb' | 'directory'>('all')
const isLoaded = ref(false)

// 面包屑导航
const breadcrumbItems = computed(() => {
  if (!currentPath.value) {
    return [{ name: '根目录', path: '' }]
  }

  const pathParts = currentPath.value.split(/[/\\]/).filter((part) => part)
  const items = [{ name: '根目录', path: '' }]

  let accumulatedPath = ''
  for (const part of pathParts) {
    accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part
    items.push({ name: part, path: accumulatedPath })
  }

  return items
})

// 计算属性
const totalCount = computed(() => fileList.value.length)

// 统计数据
const statistics = computed(() => {
  const total = fileList.value.length
  const inDatabase = fileList.value.filter((item) => item.inDatabase).length
  const notInDatabase = fileList.value.filter(
    (item) => !item.inDatabase && !item.isDirectory,
  ).length
  const directories = fileList.value.filter((item) => item.isDirectory).length
  const files = fileList.value.filter((item) => !item.isDirectory).length

  return {
    total,
    inDatabase,
    notInDatabase,
    directories,
    files,
  }
})

const filteredFileList = computed(() => {
  let result = fileList.value

  // 按类型过滤
  if (filterType.value !== 'all') {
    switch (filterType.value) {
      case 'inDb':
        result = result.filter((item) => item.inDatabase)
        break
      case 'notInDb':
        result = result.filter((item) => !item.inDatabase && !item.isDirectory)
        break
      case 'directory':
        result = result.filter((item) => item.isDirectory)
        break
    }
  }

  // 按关键词搜索
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.trim().toLowerCase()
    result = result.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword) ||
        item.path.toLowerCase().includes(keyword) ||
        item.databaseRecord?.Media?.title.toLowerCase().includes(keyword),
    )
  }

  // 排序 - 目录永远在前面
  result.sort((a, b) => {
    // 目录永远在前面
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1
    }

    // 如果有排序配置，按照指定字段排序
    if (sortConfig.value.prop) {
      let aValue = getValueByPath(a, sortConfig.value.prop)
      let bValue = getValueByPath(b, sortConfig.value.prop)

      // 特殊处理文件大小
      if (sortConfig.value.prop === 'size') {
        aValue = aValue || 0
        bValue = bValue || 0
      }

      if (sortConfig.value.order === 'ascending') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    } else {
      // 默认按名称排序
      return a.name.localeCompare(b.name)
    }
  })

  return result
})

// 处理文件ID参数的函数
const handleFileIdParam = () => {
  if (route.query.fileId) {
    const fileId = parseInt(route.query.fileId as string)
    
    // 立即清除 fileId 参数
    const query = { ...route.query }
    delete query.fileId
    router.replace({ query })
    
    // 查找并打开文件
    const fileToView = fileList.value.find(
      (f) => f.databaseRecord?.id === fileId && !f.isDirectory,
    )
    if (fileToView) {
      viewFileDetail(fileToView)
    }
  }
}

// 方法
const loadDirectoryContents = async (dirPath?: string) => {
  try {
    loading.value = true
    const response = await FileService.getDirectoryContents(dirPath)
    fileList.value = response.items
    currentPath.value = response.currentPath
    parentPath.value = response.parentPath

    // 更新URL参数
    const query = { ...route.query }
    if (response.currentPath) {
      query.path = response.currentPath
    } else {
      delete query.path
    }
    router.replace({ query })

    // 处理文件ID参数
    handleFileIdParam()
  } catch (error) {
    console.error('加载目录内容失败:', error)
    ElMessage.error('加载目录内容失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

const refreshData = () => {
  loadDirectoryContents(currentPath.value || undefined)
}

const handleSearch = () => {}

const handleSortChange = ({ prop, order }: { prop: string; order: string }) => {
  sortConfig.value = { prop, order }
}

const viewFileDetail = (file: FileSystemItem) => {
  selectedFile.value = file
  detailDialogVisible.value = true
}

const handleDetailDialogRefresh = () => {
  // 清除选中的文件，因为文件信息可能已经改变
  selectedFile.value = null
  // 刷新数据
  refreshData()
}

const handleFilterChange = (type: 'all' | 'inDb' | 'notInDb' | 'directory') => {
  filterType.value = type
}

const navigateToDirectory = (dirPath: string) => {
  if (dirPath === currentPath.value) return
  loadDirectoryContents(dirPath || undefined)
}

const navigateToParent = () => {
  if (parentPath.value !== null) {
    loadDirectoryContents(parentPath.value || undefined)
  }
}

const handleItemClick = (item: FileSystemItem) => {
  if (item.isDirectory) {
    navigateToDirectory(item.navigationPath ?? item.path)
  } else {
    viewFileDetail(item)
  }
}

// 工具函数
const getFileName = (filePath: string): string => {
  return filePath.split(/[/\\]/).pop() || filePath
}

const getFileIcon = (item: FileSystemItem) => {
  if (item.isDirectory) return Folder

  const ext = item.extension?.toLowerCase()
  if (!ext) return Document

  if (['.mp4', '.mkv', '.avi', '.wmv', '.flv', '.mov', '.webm'].includes(ext)) {
    return VideoCamera
  }
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'].includes(ext)) {
    return Picture
  }
  if (['.mp3', '.wav', '.flac', '.aac', '.ogg'].includes(ext)) {
    return Film
  }
  return Document
}

const getFileIconColor = (item: FileSystemItem): string => {
  if (item.isDirectory) return 'var(--el-color-danger)'

  const ext = item.extension?.toLowerCase()
  if (!ext) return 'var(--el-color-info)'

  if (['.mp4', '.mkv', '.avi', '.wmv', '.flv', '.mov', '.webm'].includes(ext)) {
    return 'var(--el-color-warning)'
  }
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'].includes(ext)) {
    return 'var(--el-color-success)'
  }
  if (['.mp3', '.wav', '.flac', '.aac', '.ogg'].includes(ext)) {
    return 'var(--el-color-primary)'
  }
  return 'var(--el-color-info)'
}

const formatFileSize = (size?: number): string => {
  if (!size) return '-'

  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleString('zh-CN')
  } catch {
    return dateString
  }
}

const getValueByPath = (obj: any, path: string): any => {
  return path.split('.').reduce((o, p) => o?.[p], obj)
}

const getFolderTypeLabel = (folderType: string | null | undefined): string => {
  if (!folderType) return ''
  const labels: Record<string, string> = {
    'BDMV': 'BDMV',
    'VIDEO_TS': 'DVD',
    'ISO': 'ISO'
  }
  return labels[folderType] || folderType
}

const getFolderTypeColor = (folderType: string | null | undefined): string => {
  if (!folderType) return 'info'
  const colors: Record<string, string> = {
    'BDMV': 'primary',
    'VIDEO_TS': 'success',
    'ISO': 'warning'
  }
  return colors[folderType] || 'info'
}

const getStatusTag = (item: FileSystemItem) => {
  if (item.isDirectory) {
    return { type: 'info', text: '目录', icon: Folder }
  }
  if (item.inDatabase) {
    return { type: 'success', text: '已入库', icon: Check }
  }
  return { type: 'warning', text: '未入库', icon: Warning }
}

// 生命周期
onActivated(() => {
  if (!isLoaded.value) {
    // 首次加载
    const initialPath = route.query.path as string
    loadDirectoryContents(initialPath)
    isLoaded.value = true
  } else {
    // 后续激活，检查是否有新的参数
    const newPath = ((route.query.path as string) || '').replace(/\\/g, '/')
    const current = (currentPath.value || '').replace(/\\/g, '/')
    
    if (route.query.fileId || newPath !== current) {
      // 如果有 fileId 参数或路径变化，重新加载
      loadDirectoryContents(newPath)
    }
  }
})
</script>

<template>
  <div class="file-list-view">
    <!-- 头部操作区 -->
    <div class="header-section">
      <div class="title-section">
        <h1 class="page-title">文件管理</h1>
        <div class="statistics">
          <el-tag class="stat-tag">总计: {{ statistics.total }}</el-tag>
          <el-tag type="success" class="stat-tag">已入库: {{ statistics.inDatabase }}</el-tag>
          <el-tag type="warning" class="stat-tag">未入库: {{ statistics.notInDatabase }}</el-tag>
          <el-tag type="info" class="stat-tag">目录: {{ statistics.directories }}</el-tag>
        </div>
      </div>

      <!-- 搜索和操作 -->
      <div class="actions-section">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索文件名、路径或媒体标题..."
          :prefix-icon="Search"
          clearable
          class="search-input"
          @input="handleSearch"
        />
        <el-button type="primary" :icon="Refresh" @click="refreshData" :loading="loading">
          刷新
        </el-button>
      </div>
    </div>

    <!-- 过滤器和视图切换 -->
    <div class="filter-section">
      <div class="filter-buttons">
        <el-button :type="filterType === 'all' ? 'primary' : ''" @click="handleFilterChange('all')">
          全部 ({{ statistics.total }})
        </el-button>
        <el-button
          :type="filterType === 'inDb' ? 'primary' : ''"
          @click="handleFilterChange('inDb')"
        >
          已入库 ({{ statistics.inDatabase }})
        </el-button>
        <el-button
          :type="filterType === 'notInDb' ? 'primary' : ''"
          @click="handleFilterChange('notInDb')"
        >
          未入库 ({{ statistics.notInDatabase }})
        </el-button>
        <el-button
          :type="filterType === 'directory' ? 'primary' : ''"
          @click="handleFilterChange('directory')"
        >
          目录 ({{ statistics.directories }})
        </el-button>
      </div>

      <div class="view-toggle">
        <el-radio-group v-model="viewMode">
          <el-radio-button value="grid">网格视图</el-radio-button>
          <el-radio-button value="list">列表视图</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 快速导航 -->
    <div class="navigation-section">
      <div class="navigation-header">
        <el-button
          :disabled="parentPath === null"
          :icon="ArrowLeft"
          @click="navigateToParent"
          size="small"
        >
          返回上级
        </el-button>

        <el-breadcrumb separator="/" class="breadcrumb">
          <el-breadcrumb-item
            v-for="(item, index) in breadcrumbItems"
            :key="index"
            class="breadcrumb-item"
            @click="navigateToDirectory(item.path)"
          >
            <el-icon v-if="index === 0"><House /></el-icon>
            {{ item.name }}
          </el-breadcrumb-item>
        </el-breadcrumb>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading && fileList.length === 0" class="loading-container">
      <el-skeleton :rows="5" animated />
    </div>

    <!-- 空状态 -->
    <el-empty
      v-else-if="!loading && filteredFileList.length === 0"
      description="暂无文件"
      class="empty-state"
    >
      <el-button type="primary" @click="refreshData">立即刷新</el-button>
    </el-empty>

    <!-- 网格视图 -->
    <div v-else-if="viewMode === 'grid'" class="grid-container">
      <div class="file-grid">
        <div
          v-for="item in filteredFileList"
          :key="item.fullPath"
          class="file-card"
          :class="{ 'is-directory': item.isDirectory }"
          @click="handleItemClick(item)"
          @dblclick="
            item.isDirectory
              ? navigateToDirectory(item.navigationPath ?? item.path)
              : viewFileDetail(item)
          "
        >
          <div class="file-icon-container">
            <el-icon class="file-icon" :color="getFileIconColor(item)">
              <component :is="getFileIcon(item)" />
            </el-icon>
            <div class="status-badge">
              <el-tag :type="getStatusTag(item).type" size="small" :icon="getStatusTag(item).icon">
                {{ getStatusTag(item).text }}
              </el-tag>
            </div>
          </div>

          <div class="file-info">
            <div class="file-name" :title="item.name">
              {{ item.name }}
            </div>

            <div class="file-meta">
              <div class="file-time">
                {{ formatDate(item.modifiedTime) }}
              </div>
              <div v-if="!item.isDirectory" class="file-size">
                {{ formatFileSize(item.size) }}
              </div>
            </div>

            <div v-if="item.databaseRecord?.Media" class="media-info-with-tags">
              <el-tag 
                type="primary" 
                size="small" 
                class="media-title-tag"
                :title="item.databaseRecord.Media.title"
              >
                {{ item.databaseRecord.Media.title }}
              </el-tag>
              <!-- 特殊文件夹标识 - 只对目录显示 -->
              <div v-if="item.isDirectory && item.isSpecialFolder" class="folder-tags">
                <el-tag 
                  :type="getFolderTypeColor(item.folderType)" 
                  size="small"
                  effect="dark"
                >
                  {{ getFolderTypeLabel(item.folderType) }}
                </el-tag>
                <el-tag 
                  v-if="item.isMultiDisc && item.discNumber" 
                  type="info" 
                  size="small"
                >
                  碟片 {{ item.discNumber }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 列表视图 -->
    <div v-else class="table-container">
      <el-table
        :data="filteredFileList"
        style="width: 100%"
        stripe
        :default-sort="{ prop: 'modifiedTime', order: 'descending' }"
        @sort-change="handleSortChange"
        @row-click="handleItemClick"
        row-class-name="clickable-row"
      >
        <el-table-column type="index" width="50" />

        <el-table-column prop="name" label="名称" min-width="300" sortable="custom">
          <template #default="{ row }">
            <div class="file-item" :class="{ 'is-directory': row.isDirectory }">
              <el-icon class="file-icon" :color="getFileIconColor(row)">
                <component :is="getFileIcon(row)" />
              </el-icon>
              <div class="file-info">
                <div class="file-name-row">
                  <span class="file-name" :title="row.name">
                    {{ row.name }}
                  </span>
                  <!-- 特殊文件夹标识 -->
                  <div v-if="row.isDirectory && row.isSpecialFolder" class="folder-tags-inline">
                    <el-tag 
                      :type="getFolderTypeColor(row.folderType)" 
                      size="small"
                      effect="dark"
                    >
                      {{ getFolderTypeLabel(row.folderType) }}
                    </el-tag>
                    <el-tag 
                      v-if="row.isMultiDisc && row.discNumber" 
                      type="info" 
                      size="small"
                    >
                      碟片 {{ row.discNumber }}
                    </el-tag>
                  </div>
                </div>
                <div class="file-path" :title="row.path">
                  {{ row.path }}
                </div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="size" label="大小" width="120" sortable="custom">
          <template #default="{ row }">
            <span class="file-size">{{ formatFileSize(row.size) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTag(row).type" size="small" :icon="getStatusTag(row).icon">
              {{ getStatusTag(row).text }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="关联媒体" width="200">
          <template #default="{ row }">
            <div v-if="row.databaseRecord?.Media" class="media-info">
              <el-tag type="primary" size="small">{{ row.databaseRecord.Media.title }}</el-tag>
            </div>
            <span v-else class="no-media">-</span>
          </template>
        </el-table-column>

        <el-table-column label="剧集信息" width="150">
          <template #default="{ row }">
            <div v-if="row.databaseRecord?.episode" class="episode-info">
              <el-tag type="success" size="small">
                第{{ row.databaseRecord.episode.episodeNumber }}集
              </el-tag>
            </div>
            <span v-else class="no-episode">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="modifiedTime" label="修改时间" width="180" sortable="custom">
          <template #default="{ row }">
            <span>{{ formatDate(row.modifiedTime) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 文件详情对话框 -->
    <FileDetailDialog
      v-model:visible="detailDialogVisible"
      :file-info="selectedFile"
      @refresh="handleDetailDialogRefresh"
    />
  </div>
</template>

<style scoped>
.file-list-view {
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
  margin: 0 0 12px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--color-heading);
}

.statistics {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stat-tag {
  font-size: 14px;
}

.actions-section {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-input {
  width: 320px;
}

/* 过滤器区域 */
.filter-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-background);
  padding: 16px 24px;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.filter-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.view-toggle {
  display: flex;
  align-items: center;
}

/* 导航区域 */
.navigation-section {
  background: var(--color-background);
  padding: 16px 24px;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.navigation-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.breadcrumb {
  flex: 1;
}

.breadcrumb-item {
  cursor: pointer;
  transition: color 0.2s;
}

.breadcrumb-item:hover {
  color: var(--el-color-primary);
}

.breadcrumb :deep(.el-breadcrumb__inner) {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 网格视图 */
.grid-container {
  background: var(--color-background);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 24px;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.file-card {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--color-background-soft);
  position: relative;
}

.file-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
  transform: translateY(-2px);
}

.file-card.is-directory {
  border-color: var(--color-border);
  background: var(--color-background-mute);
}

.file-card.is-directory:hover {
  border-color: var(--el-color-danger);
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.15);
  background: var(--el-color-danger-light-9);
}

.file-icon-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 16px;
  position: relative;
}

.file-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.status-badge {
  position: absolute;
  top: -8px;
  right: -8px;
}

.file-info {
  text-align: center;
}

.file-name {
  font-weight: 500;
  color: var(--color-heading);
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.folder-tags {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.file-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--color-text);
}

.file-size {
  font-family: monospace;
}

.file-time {
  font-size: 11px;
}

.media-info {
  margin-top: 8px;
}

.media-info-with-tags {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
}

.media-info-with-tags .media-title-tag {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
}

.media-info-with-tags .media-title-tag :deep(.el-tag__content) {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.media-info-with-tags .folder-tags {
  margin-top: 0;
  margin-left: auto;
  flex-shrink: 0;
}

/* 表格容器 */
.table-container {
  background: var(--color-background);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.table-container :deep(.clickable-row) {
  cursor: pointer;
}

.table-container :deep(.clickable-row:hover) {
  background-color: var(--color-background-soft);
}

/* 文件项 */
.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  transition: background-color 0.2s;
  padding: 4px;
  border-radius: 4px;
}

.file-item.is-directory {
  cursor: pointer;
}

.file-item.is-directory:hover {
  background-color: var(--color-background-soft);
}

.file-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.file-name {
  font-weight: 500;
  color: var(--color-heading);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-tags-inline {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.file-path {
  font-size: 12px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.file-size {
  font-family: monospace;
  color: var(--color-text);
}

.media-info,
.episode-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.no-media,
.no-episode,
.no-link {
  color: var(--el-color-info);
  font-style: italic;
}

.link-path {
  font-size: 12px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 加载和空状态 */
.loading-container {
  background: var(--color-background);
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.empty-state {
  background: var(--color-background);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 60px 24px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .file-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }
}

@media (max-width: 768px) {
  .file-list-view {
    padding: 16px;
  }

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
    gap: 16px;
    align-items: stretch;
  }

  .filter-buttons {
    justify-content: center;
  }

  .view-toggle {
    justify-content: center;
  }

  .file-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .statistics {
    justify-content: center;
  }

  .file-name {
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
  }

  .table-container :deep(.action-column) {
    display: none;
  }
}

@media (max-width: 480px) {
  .filter-buttons {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-buttons .el-button {
    justify-content: center;
    margin-left: 0;
  }
}
</style>
