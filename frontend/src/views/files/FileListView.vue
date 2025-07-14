<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import { 
  Search, 
  Refresh, 
  House, 
  View, 
  Document, 
  VideoCamera, 
  Picture,
  Film,
  Folder
} from '@element-plus/icons-vue'
import { FileService } from '@/api/files'
import type { FileInfo } from '@/api/files/types'
import FileDetailDialog from './components/FileDetailDialog.vue'

// 定义组件名称以支持 keep-alive
defineOptions({
  name: 'FileListView'
})

// 路由
const route = useRoute()

// 响应式数据
const loading = ref(false)
const fileList = ref<FileInfo[]>([])
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = 20
const sortConfig = ref<{prop: string, order: string}>({ prop: 'createdAt', order: 'descending' })
const detailDialogVisible = ref(false)
const selectedFile = ref<FileInfo | null>(null)

// 面包屑导航
const breadcrumbItems = ref([
  { name: '文件管理' }
])

// 计算属性
const totalCount = computed(() => fileList.value.length)

const filteredFileList = computed(() => {
  let result = fileList.value

  // 按关键词搜索
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.trim().toLowerCase()
    result = result.filter(file => 
      file.filePath.toLowerCase().includes(keyword) ||
      file.linkPath?.toLowerCase().includes(keyword) ||
      file.Media?.title.toLowerCase().includes(keyword)
    )
  }

  // 排序
  if (sortConfig.value.prop) {
    result.sort((a, b) => {
      let aValue = getValueByPath(a, sortConfig.value.prop)
      let bValue = getValueByPath(b, sortConfig.value.prop)
      
      // 特殊处理文件大小
      if (sortConfig.value.prop === 'fileSize') {
        aValue = parseInt(aValue as string) || 0
        bValue = parseInt(bValue as string) || 0
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

const displayedFileList = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return filteredFileList.value.slice(start, end)
})

// 方法
const loadFileList = async () => {
  try {
    loading.value = true
    fileList.value = await FileService.getAllFiles()
    
    // 检查是否有fileId查询参数，如果有则自动显示对应文件详情
    const fileId = route.query.fileId as string
    if (fileId) {
      const targetFile = fileList.value.find(file => file.id.toString() === fileId)
      if (targetFile) {
        viewFileDetail(targetFile)
      } else {
        ElMessage.warning('未找到指定的文件')
      }
    }
  } catch (error) {
    console.error('加载文件列表失败:', error)
    ElMessage.error('加载文件列表失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

const refreshData = () => {
  currentPage.value = 1
  loadFileList()
}

const handleSearch = () => {
  currentPage.value = 1
}

const handlePageChange = (page: number) => {
  currentPage.value = page
}

const handleSortChange = ({ prop, order }: { prop: string; order: string }) => {
  sortConfig.value = { prop, order }
}

const viewFileDetail = (file: FileInfo) => {
  selectedFile.value = file
  detailDialogVisible.value = true
}

// 工具函数
const getFileName = (filePath: string): string => {
  return filePath.split(/[/\\]/).pop() || filePath
}

const getFileIcon = (filePath: string) => {
  const ext = filePath.split('.').pop()?.toLowerCase()
  if (!ext) return Document
  
  if (['mp4', 'mkv', 'avi', 'wmv', 'flv', 'mov', 'webm'].includes(ext)) {
    return VideoCamera
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) {
    return Picture
  }
  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) {
    return Film
  }
  return Document
}

const getFileIconColor = (filePath: string): string => {
  const ext = filePath.split('.').pop()?.toLowerCase()
  if (!ext) return '#909399'
  
  if (['mp4', 'mkv', 'avi', 'wmv', 'flv', 'mov', 'webm'].includes(ext)) {
    return '#E6A23C'
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) {
    return '#67C23A'
  }
  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) {
    return '#409EFF'
  }
  return '#909399'
}

const formatFileSize = (sizeStr: string): string => {
  const size = parseInt(sizeStr)
  if (isNaN(size)) return sizeStr
  
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

// 生命周期
onMounted(() => {
  loadFileList()
})

// 监听路由查询参数变化
watch(
  () => route.query.fileId,
  (newFileId) => {
    if (newFileId && fileList.value.length > 0) {
      const targetFile = fileList.value.find(file => file.id.toString() === newFileId)
      if (targetFile) {
        viewFileDetail(targetFile)
      }
    }
  }
)
</script>

<template>
  <div class="file-list-view">
    <!-- 头部操作区 -->
    <div class="header-section">
      <div class="title-section">
        <h1 class="page-title">文件管理</h1>
        <p class="page-description">共 {{ totalCount }} 个文件</p>
      </div>

      <!-- 搜索和操作 -->
      <div class="actions-section">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索文件名..."
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

    <!-- 快速导航 -->
    <div class="navigation-section">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>
          <el-icon><House /></el-icon>
          根目录
        </el-breadcrumb-item>
        <el-breadcrumb-item v-for="item in breadcrumbItems" :key="item.name">
          {{ item.name }}
        </el-breadcrumb-item>
      </el-breadcrumb>
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

    <!-- 文件表格 -->
    <div v-else class="table-container">
      <el-table
        :data="displayedFileList"
        style="width: 100%"
        stripe
        :default-sort="{ prop: 'createdAt', order: 'descending' }"
        @sort-change="handleSortChange"
      >
        <el-table-column type="index" width="50" />
        
        <el-table-column prop="filePath" label="文件名" min-width="300" sortable>
          <template #default="{ row }">
            <div class="file-item">
              <el-icon class="file-icon" :color="getFileIconColor(row.filePath)">
                <component :is="getFileIcon(row.filePath)" />
              </el-icon>
              <div class="file-info">
                <div class="file-name" :title="getFileName(row.filePath)">
                  {{ getFileName(row.filePath) }}
                </div>
                <div class="file-path" :title="row.filePath">
                  {{ row.filePath }}
                </div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="fileSize" label="文件大小" width="120" sortable>
          <template #default="{ row }">
            <span class="file-size">{{ formatFileSize(row.fileSize) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="Media" label="关联媒体" width="200">
          <template #default="{ row }">
            <div v-if="row.Media" class="media-info">
              <el-tag type="primary" size="small">{{ row.Media.title }}</el-tag>
            </div>
            <span v-else class="no-media">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="episode" label="剧集信息" width="150">
          <template #default="{ row }">
            <div v-if="row.episode" class="episode-info">
              <el-tag type="success" size="small">
                第{{ row.episode.episodeNumber }}集
              </el-tag>
            </div>
            <span v-else class="no-episode">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="linkPath" label="硬链接路径" min-width="300">
          <template #default="{ row }">
            <div v-if="row.linkPath" class="link-path" :title="row.linkPath">
              {{ row.linkPath }}
            </div>
            <span v-else class="no-link">未创建</span>
          </template>
        </el-table-column>

        <el-table-column prop="createdAt" label="创建时间" width="180" sortable>
          <template #default="{ row }">
            <span>{{ formatDate(row.createdAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              @click="viewFileDetail(row)"
              :icon="View"
            >
              查看
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <div v-if="filteredFileList.length > pageSize" class="pagination-container">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="filteredFileList.length"
        layout="total, prev, pager, next, jumper"
        @current-change="handlePageChange"
      />
    </div>

    <!-- 文件详情对话框 -->
    <FileDetailDialog
      v-model:visible="detailDialogVisible"
      :file-info="selectedFile"
    />
  </div>
</template>

<style scoped>
.file-list-view {
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

/* 导航区域 */
.navigation-section {
  background: white;
  padding: 16px 24px;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 表格容器 */
.table-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

/* 文件项 */
.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-path {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.file-size {
  font-family: monospace;
  color: #606266;
}

.media-info, .episode-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.no-media, .no-episode, .no-link {
  color: #C0C4CC;
  font-style: italic;
}

.link-path {
  font-size: 12px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  
  .file-list-view {
    padding: 16px;
  }
}
</style>
