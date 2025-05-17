<template>
  <div class="files-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <h2>文件管理</h2>
          <div class="search-area">
            <el-input
              v-model="searchQuery"
              placeholder="搜索文件路径..."
              class="search-input"
              clearable
              @input="handleSearch"
            >
              <template #prefix>
                <el-icon><el-icon-search /></el-icon>
              </template>
            </el-input>
          </div>
        </div>
      </template>

      <div v-loading="loading">
        <div class="table-container">
          <el-table
            :data="paginatedFiles"
            v-if="filteredFiles.length > 0"
            @row-click="showFileDetail"
            :max-height="tableMaxHeight"
          >
            <el-table-column label="ID" prop="id" width="80" :show-overflow-tooltip="true" />
            <el-table-column label="文件名" min-width="200" :show-overflow-tooltip="true">
              <template #default="scope">
                {{ getFileName(scope.row.filePath) }}
              </template>
            </el-table-column>
            <el-table-column label="大小" width="120" :show-overflow-tooltip="true">
              <template #default="scope">
                {{ formatSize(scope.row.fileSize) }}
              </template>
            </el-table-column>
            <el-table-column label="添加日期" width="180" :show-overflow-tooltip="true" class="date-column">
              <template #default="scope">
                {{ formatDate(scope.row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="关联媒体" min-width="150">
              <template #default="scope">
                <el-button
                  v-if="scope.row.Media"
                  type="primary"
                  size="small"
                  @click.stop="goToMediaDetail(scope.row.Media.id)"
                >
                  {{ scope.row.Media.title }}
                </el-button>
                <el-tag v-else type="info">无关联</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <el-empty v-if="filteredFiles.length === 0 && !loading" description="没有找到文件" />

        <div class="pagination-container" v-if="filteredFiles.length > 0">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :layout="paginationLayout"
            :small="isMobileView"
            :total="filteredFiles.length"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </div>
    </el-card>

    <!-- 文件详情对话框 -->
    <el-dialog
      v-model="fileDetailVisible"
      title="文件详情"
      :width="dialogWidth"
      destroy-on-close
      fullscreen-on-mobile
    >
      <div v-if="selectedFile" class="file-detail">
        <el-descriptions :column="descriptionColumns" border>
          <el-descriptions-item label="ID">{{ selectedFile.id }}</el-descriptions-item>
          <el-descriptions-item label="设备ID">{{ selectedFile.deviceId }}</el-descriptions-item>
          <el-descriptions-item label="Inode">{{ selectedFile.inode }}</el-descriptions-item>
          <el-descriptions-item label="文件哈希">{{ selectedFile.fileHash }}</el-descriptions-item>
          <el-descriptions-item label="文件大小">{{ formatSize(selectedFile.fileSize) }}</el-descriptions-item>
          <el-descriptions-item label="原始路径">
            <div class="path-wrapper">{{ selectedFile.filePath }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="硬链接路径">
            <div class="path-wrapper">{{ selectedFile.linkPath }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="添加日期">{{ formatDate(selectedFile.createdAt) }}</el-descriptions-item>
        </el-descriptions>

        <div v-if="selectedFile.Media" class="related-media">
          <h3>关联媒体</h3>
          <el-card class="media-card">
            <div class="media-info">
              <div v-if="selectedFile.Media.posterUrl" class="media-poster">
                <img :src="getImageUrl(selectedFile.Media.posterUrl)" :alt="selectedFile.Media.title" />
              </div>
              <div class="media-details">
                <h4>{{ selectedFile.Media.title }}</h4>
                <p v-if="selectedFile.Media.releaseDate">
                  发布日期: {{ formatDate(selectedFile.Media.releaseDate) }}
                </p>
                <el-tag :type="getMediaTypeTag(selectedFile.Media.type)">
                  {{ getMediaTypeLabel(selectedFile.Media.type) }}
                </el-tag>
                <div class="view-button">
                  <el-button type="primary" @click="goToMediaDetail(selectedFile.Media.id)">
                    查看媒体详情
                  </el-button>
                </div>
              </div>
            </div>
          </el-card>
        </div>

        <div v-if="selectedFile.episode" class="related-episode">
          <h3>关联剧集</h3>
          <el-card>
            <div class="episode-info">
              <div v-if="selectedFile.episode.posterUrl" class="episode-poster">
                <img :src="getImageUrl(selectedFile.episode.posterUrl)" :alt="'Episode ' + selectedFile.episode.id" />
              </div>
              <div class="episode-details">
                <h4>剧集 #{{ selectedFile.episode.id }}</h4>
                <p v-if="selectedFile.episode.releaseDate">
                  播出日期: {{ formatDate(selectedFile.episode.releaseDate) }}
                </p>
                <p v-if="selectedFile.episode.description">
                  {{ selectedFile.episode.description }}
                </p>
              </div>
            </div>
          </el-card>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Search as ElIconSearch } from '@element-plus/icons-vue'
import { api, getImageUrl } from '../api'
import type { File } from '../api'

const router = useRouter()
const route = useRoute()
const loading = ref(true)
const allFiles = ref<File[]>([])
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const fileDetailVisible = ref(false)
const selectedFile = ref<File | null>(null)
const tableMaxHeight = ref('calc(100vh - 300px)')
const isMobileView = ref(false)

// 响应式布局相关计算属性
const dialogWidth = computed(() => {
  return isMobileView.value ? '95%' : '70%' 
})

const descriptionColumns = computed(() => {
  return isMobileView.value ? 1 : 1
})

const paginationLayout = computed(() => {
  return isMobileView.value ? 'prev, pager, next' : 'total, sizes, prev, pager, next'
})

// 文件过滤逻辑
const filteredFiles = computed(() => {
  if (!searchQuery.value) {
    return allFiles.value
  }
  
  const query = searchQuery.value.toLowerCase()
  return allFiles.value.filter(file => 
    file.filePath.toLowerCase().includes(query) || 
    file.linkPath.toLowerCase().includes(query) ||
    (file.Media && file.Media.title.toLowerCase().includes(query))
  )
})

// 分页逻辑
const paginatedFiles = computed(() => {
  const startIndex = (currentPage.value - 1) * pageSize.value
  const endIndex = startIndex + pageSize.value
  return filteredFiles.value.slice(startIndex, endIndex)
})

// 格式化文件大小
const formatSize = (sizeInBytes: string) => {
  const size = parseInt(sizeInBytes)
  if (size < 1024) return `${size} B`
  const sizeInKB = size / 1024
  if (sizeInKB < 1024) return `${sizeInKB.toFixed(2)} KB`
  const sizeInMB = sizeInKB / 1024
  if (sizeInMB < 1024) return `${sizeInMB.toFixed(2)} MB`
  const sizeInGB = sizeInMB / 1024
  return `${sizeInGB.toFixed(2)} GB`
}

// 格式化日期
const formatDate = (dateString: string) => {
  if (!dateString) return '未知'
  const date = new Date(dateString)
  
  if (isMobileView.value) {
    return date.toLocaleDateString('zh-CN')
  }
  
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// 获取文件名
const getFileName = (filePath: string) => {
  if (!filePath) return '未知文件'
  return filePath.split('/').pop() || filePath.split('\\').pop() || filePath
}

// 媒体类型处理
const getMediaTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    tv: '电视剧',
    movie: '电影',
    collection: '合集'
  }
  return labels[type] || type
}

const getMediaTypeTag = (type: string) => {
  const tags: Record<string, string> = {
    tv: 'success',
    movie: 'primary',
    collection: 'warning'
  }
  return tags[type] || ''
}

// 搜索处理
const handleSearch = () => {
  currentPage.value = 1 // 重置到第一页
}

// 分页处理
const handleSizeChange = (size: number) => {
  pageSize.value = size
  currentPage.value = 1
}

const handleCurrentChange = (page: number) => {
  currentPage.value = page
}

// 查看文件详情
const showFileDetail = (file: File) => {
  selectedFile.value = file
  fileDetailVisible.value = true
}

// 跳转到媒体详情
const goToMediaDetail = (mediaId: number) => {
  router.push(`/media/${mediaId}`)
}

// 检查URL参数中是否有指定文件ID
watch(allFiles, () => {
  const fileId = route.query.id
  if (fileId && allFiles.value.length > 0) {
    const id = parseInt(fileId as string)
    const file = allFiles.value.find(f => f.id === id)
    if (file) {
      selectedFile.value = file
      fileDetailVisible.value = true
    }
  }
})

// 检测屏幕尺寸变化
const checkScreenSize = () => {
  isMobileView.value = window.innerWidth <= 768
  
  // 动态调整表格高度
  if (window.innerWidth <= 768) {
    tableMaxHeight.value = 'calc(100vh - 250px)'
  } else {
    tableMaxHeight.value = 'calc(100vh - 300px)'
  }
}

// 初始化加载数据
onMounted(async () => {
  try {
    const response = await api.getAllFiles()
    allFiles.value = response.data
  } catch (error) {
    console.error('获取文件列表失败:', error)
  } finally {
    loading.value = false
  }
  
  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkScreenSize)
})
</script>

<style scoped>
.files-view {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
}

.search-area {
  display: flex;
  gap: 10px;
}

.search-input {
  width: 250px;
}

.table-container {
  overflow-x: auto;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.file-detail {
  margin-top: 20px;
}

.path-wrapper {
  word-break: break-all;
  max-width: 100%;
}

.related-media, 
.related-episode {
  margin-top: 30px;
}

.media-card {
  margin-top: 10px;
}

.media-info,
.episode-info {
  display: flex;
  gap: 20px;
}

.media-poster,
.episode-poster {
  width: 120px;
  flex-shrink: 0;
}

.media-poster img,
.episode-poster img {
  width: 100%;
  border-radius: 4px;
}

.media-details,
.episode-details {
  flex: 1;
}

.media-details h4,
.episode-details h4 {
  margin-top: 0;
  margin-bottom: 10px;
}

.view-button {
  margin-top: 15px;
}

/* 移动端响应式调整 */
@media (max-width: 768px) {
  .files-view {
    padding: 10px;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .search-area {
    width: 100%;
  }
  
  .search-input {
    width: 100%;
  }
  
  .date-column {
    display: none;
  }
  
  .media-info,
  .episode-info {
    flex-direction: column;
  }
  
  .media-poster,
  .episode-poster {
    width: 100%;
    max-width: 200px;
    margin: 0 auto 10px;
  }
}
</style>