<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  ArrowLeft, 
  Picture, 
  Document, 
  Calendar, 
  View, 
  VideoPlay 
} from '@element-plus/icons-vue'
import { MediaService } from '@/api/media'
import type { Media, MediaFile, MediaType } from '@/api/media/types'

// 路由
const route = useRoute()
const router = useRouter()

// 响应式数据
const loading = ref(false)
const error = ref('')
const media = ref<Media | null>(null)

// 方法
const loadMediaDetail = async () => {
  try {
    loading.value = true
    error.value = ''
    const id = Number(route.params.id)
    if (!id) {
      throw new Error('无效的媒体ID')
    }
    media.value = await MediaService.getMediaById(id)
  } catch (err: unknown) {
    console.error('加载媒体详情失败:', err)
    if (err instanceof Error) {
      error.value = err.message
    } else {
      error.value = '加载媒体详情失败，请稍后重试'
    }
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  // 优先使用浏览器历史记录返回
  if (window.history.length > 1) {
    router.back()
  } else {
    // 如果没有历史记录，则直接跳转到媒体列表页面
    router.push('/media')
  }
}

const getTypeLabel = (type: MediaType): string => {
  const labels = {
    tv: '电视剧',
    movie: '电影',
    collection: '合集'
  }
  return labels[type] || type
}

const getTypeTagType = (type: MediaType) => {
  const types = {
    tv: 'primary',
    movie: 'success',
    collection: 'warning'
  }
  return types[type] || 'info'
}

const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString('zh-CN')
  } catch {
    return dateString
  }
}

const getFileName = (filePath: string): string => {
  return filePath.split(/[/\\]/).pop() || filePath
}

const formatFileSize = (sizeStr: string): string => {
  const size = parseInt(sizeStr)
  if (isNaN(size)) return sizeStr
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let unitIndex = 0
  let fileSize = size
  
  while (fileSize >= 1024 && unitIndex < units.length - 1) {
    fileSize /= 1024
    unitIndex++
  }
  
  return `${fileSize.toFixed(1)} ${units[unitIndex]}`
}

const viewFile = (file: MediaFile) => {
  // 跳转到文件管理页面，并传递文件ID和路径作为查询参数
  const pathParts = file.filePath.split(/[/\\]/)
  pathParts.pop() // 移除文件名

  // 移除第一级根目录
  if (pathParts.length > 0) {
    pathParts.shift()
  }

  const dirPath = pathParts.join('/')

  const query: { path?: string; fileId: string } = {
    fileId: file.id.toString(),
  }

  if (dirPath) {
    query.path = dirPath
  }

  router.push({
    path: '/files',
    query,
  })
}

// 生命周期
onMounted(() => {
  loadMediaDetail()
})
</script>

<template>
  <div class="media-detail-view">
    <!-- 返回按钮 -->
    <div class="header-section">
      <el-button 
        :icon="ArrowLeft" 
        @click="goBack"
        class="back-button"
      >
        返回
      </el-button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <el-skeleton :rows="8" animated />
    </div>

    <!-- 错误状态 -->
    <el-result 
      v-else-if="error"
      icon="error"
      title="加载失败"
      :sub-title="error"
    >
      <template #extra>
        <el-button type="primary" @click="loadMediaDetail">重新加载</el-button>
      </template>
    </el-result>

    <!-- 媒体详情 -->
    <div v-else-if="media" class="detail-content">
      <!-- 媒体基本信息 -->
      <div class="media-info-card">
        <div class="media-header">
          <div class="poster-section">
            <el-image
              :src="media.posterUrl || '/images/placeholder.svg'"
              :alt="media.title"
              class="poster-image"
              fit="cover"
            >
              <template #error>
                <div class="poster-placeholder">
                  <el-icon size="60" color="#c0c4cc">
                    <Picture />
                  </el-icon>
                </div>
              </template>
            </el-image>
          </div>

          <div class="info-section">
            <div class="title-section">
              <h1 class="media-title">{{ media.title }}</h1>
              <p v-if="media.originalTitle" class="original-title">
                {{ media.originalTitle }}
              </p>
              
              <div class="meta-info">
                <el-tag 
                  :type="getTypeTagType(media.type)" 
                  size="large"
                  effect="dark"
                >
                  {{ getTypeLabel(media.type) }}
                </el-tag>
                
                <span v-if="media.releaseDate" class="release-date">
                  {{ formatDate(media.releaseDate) }}
                </span>
              </div>
            </div>

            <div v-if="media.description" class="description-section">
              <h3>简介</h3>
              <p class="description">{{ media.description }}</p>
            </div>

            <div class="stats-section">
              <div class="stat-item">
                <el-icon><Document /></el-icon>
                <span>{{ media.files?.length || 0 }} 个文件</span>
              </div>
              <div class="stat-item">
                <el-icon><Calendar /></el-icon>
                <span>{{ formatDate(media.createdAt) }} 添加</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 文件列表 -->
      <div v-if="media.files && media.files.length > 0" class="files-section">
        <h2 class="section-title">
          <el-icon><Document /></el-icon>
          关联文件 ({{ media.files.length }})
        </h2>
        
        <div class="files-list">
          <div 
            v-for="file in media.files" 
            :key="file.id"
            class="file-item"
          >
            <div class="file-info">
              <div class="file-name">{{ getFileName(file.filePath) }}</div>
              <div class="file-meta">
                <span class="file-size">{{ formatFileSize(file.fileSize) }}</span>
                <span class="file-path">{{ file.filePath }}</span>
              </div>
            </div>
            
            <div class="file-actions">
              <el-button 
                size="small" 
                type="primary" 
                :icon="View"
                @click="viewFile(file)"
              >
                查看
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 剧集信息（仅电视剧） -->
      <div v-if="media.type === 'tv' && media.tvInfos && media.tvInfos.length > 0" class="episodes-section">
        <h2 class="section-title">
          <el-icon><VideoPlay /></el-icon>
          剧集信息
        </h2>
        
        <div v-for="tvInfo in media.tvInfos" :key="tvInfo.id" class="tv-info">
          <div v-if="tvInfo.episodes && tvInfo.episodes.length > 0" class="episodes-grid">
            <div 
              v-for="episode in tvInfo.episodes" 
              :key="episode.id"
              class="episode-card"
            >
              <div class="episode-poster">
                <el-image
                  :src="episode.posterUrl || '/images/placeholder.svg'"
                  :alt="`第${episode.episodeNumber}集`"
                  class="episode-image"
                  fit="cover"
                >
                  <template #error>
                    <div class="episode-placeholder">
                      <el-icon size="20" color="#c0c4cc">
                        <VideoPlay />
                      </el-icon>
                    </div>
                  </template>
                </el-image>
              </div>
              
              <div class="episode-info">
                <div class="episode-number">第 {{ episode.episodeNumber }} 集</div>
                <div v-if="episode.title" class="episode-title">{{ episode.title }}</div>
                <div v-if="episode.releaseDate" class="episode-date">
                  {{ formatDate(episode.releaseDate) }}
                </div>
                <div v-if="episode.description" class="episode-description">
                  {{ episode.description }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.media-detail-view {
  padding: 24px;
  min-height: 100%;
  background-color: #f5f7fa;
}

/* 头部区域 */
.header-section {
  margin-bottom: 24px;
}

.back-button {
  background: white;
  border: 1px solid #dcdfe6;
}

/* 加载状态 */
.loading-container {
  background: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 详情内容 */
.detail-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 媒体信息卡片 */
.media-info-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.media-header {
  display: flex;
  padding: 24px;
  gap: 24px;
}

.poster-section {
  flex-shrink: 0;
}

.poster-image {
  width: 200px;
  height: 300px;
  border-radius: 8px;
  object-fit: cover;
}

.poster-placeholder {
  width: 200px;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.info-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.title-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.media-title {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
  color: #303133;
  line-height: 1.3;
}

.original-title {
  margin: 0;
  font-size: 16px;
  color: #909399;
  font-style: italic;
}

.meta-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.release-date {
  font-size: 14px;
  color: #606266;
}

.description-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.description {
  margin: 0;
  font-size: 14px;
  color: #606266;
  line-height: 1.6;
}

.stats-section {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #606266;
}

/* 区块标题 */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

/* 文件列表 */
.files-section {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.files-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
  word-break: break-all;
}

.file-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #909399;
  flex-wrap: wrap;
}

.file-size {
  font-weight: 500;
}

.file-path {
  word-break: break-all;
}

.file-actions {
  flex-shrink: 0;
  margin-left: 16px;
}

/* 剧集信息 */
.episodes-section {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.episodes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.episode-card {
  display: flex;
  background: #f8f9fa;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e9ecef;
  transition: all 0.2s ease;
}

.episode-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.episode-poster {
  flex-shrink: 0;
  width: 80px;
  height: 60px;
}

.episode-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.episode-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e9ecef;
}

.episode-info {
  flex: 1;
  padding: 12px;
  min-width: 0;
}

.episode-number {
  font-size: 12px;
  font-weight: 600;
  color: #409eff;
  margin-bottom: 2px;
}

.episode-title {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.episode-date {
  font-size: 11px;
  color: #909399;
  margin-bottom: 4px;
}

.episode-description {
  font-size: 11px;
  color: #606266;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .media-detail-view {
    padding: 16px;
  }

  .media-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 16px;
  }

  .poster-image,
  .poster-placeholder {
    width: 150px;
    height: 225px;
  }

  .media-title {
    font-size: 24px;
  }

  .stats-section {
    justify-content: center;
  }

  .file-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .file-actions {
    margin-left: 0;
    width: 100%;
  }

  .file-actions .el-button {
    width: 100%;
  }

  .episodes-grid {
    grid-template-columns: 1fr;
  }
}
</style>
