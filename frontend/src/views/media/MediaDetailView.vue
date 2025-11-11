<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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

// 组织文件结构：将父文件夹和子文件夹分组
const organizedFiles = computed(() => {
  if (!media.value?.files) return { parentFolders: [], regularFiles: [] }
  
  const parentFolders: MediaFile[] = []
  const regularFiles: MediaFile[] = []
  const childFileIds = new Set<number>()
  
  // 首先收集所有父文件夹
  media.value.files.forEach(file => {
    if (file.isParentFolder && file.childFolders && file.childFolders.length > 0) {
      parentFolders.push(file)
      // 记录所有子文件夹的ID
      file.childFolders.forEach(child => childFileIds.add(child.id))
    }
  })
  
  // 然后收集所有非子文件夹的常规文件
  media.value.files.forEach(file => {
    if (!file.isParentFolder && !childFileIds.has(file.id)) {
      regularFiles.push(file)
    }
  })
  
  return { parentFolders, regularFiles }
})

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
  // if (pathParts.length > 0) {
  //   pathParts.shift()
  // }

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
        
        <!-- 父文件夹列表 -->
        <div v-if="organizedFiles.parentFolders.length > 0" class="parent-folders-list">
          <div 
            v-for="parentFolder in organizedFiles.parentFolders" 
            :key="parentFolder.id"
            class="parent-folder-group"
          >
            <!-- 父文件夹头部 -->
            <div class="parent-folder-header">
              <div class="parent-folder-info">
                <el-icon class="folder-icon" color="#f56c6c" size="20">
                  <Document />
                </el-icon>
                <span class="parent-folder-name">{{ getFileName(parentFolder.filePath) }}</span>
                <el-tag type="warning" size="small" effect="dark">
                  包含 {{ parentFolder.childFolders?.length || 0 }} 个子卷
                </el-tag>
              </div>
              <div class="parent-folder-actions">
                <el-button 
                  size="small" 
                  type="primary" 
                  :icon="View"
                  @click="viewFile(parentFolder)"
                >
                  查看
                </el-button>
              </div>
            </div>
            
            <!-- 子文件夹列表 -->
            <div class="child-folders-list">
              <div 
                v-for="childFolder in parentFolder.childFolders" 
                :key="childFolder.id"
                class="file-item child-file-item"
              >
                <div class="file-info">
                  <div class="file-name-row">
                    <span class="file-name">{{ getFileName(childFolder.filePath) }}</span>
                    <!-- 特殊文件夹标识 -->
                    <div v-if="childFolder.isDirectory && childFolder.isSpecialFolder" class="folder-tags">
                      <el-tag 
                        :type="getFolderTypeColor(childFolder.folderType)" 
                        size="small"
                        effect="dark"
                      >
                        {{ getFolderTypeLabel(childFolder.folderType) }}
                      </el-tag>
                      <el-tag 
                        v-if="childFolder.isMultiDisc && childFolder.discNumber" 
                        type="info" 
                        size="small"
                      >
                        碟片 {{ childFolder.discNumber }}
                      </el-tag>
                    </div>
                  </div>
                  <div class="file-meta">
                    <span class="file-size">{{ formatFileSize(childFolder.fileSize) }}</span>
                    <span class="file-path">{{ childFolder.filePath }}</span>
                  </div>
                </div>
                
                <div class="file-actions">
                  <el-button 
                    size="small" 
                    type="primary" 
                    :icon="View"
                    @click="viewFile(childFolder)"
                  >
                    查看
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 常规文件列表 -->
        <div v-if="organizedFiles.regularFiles.length > 0" class="files-list">
          <div 
            v-for="file in organizedFiles.regularFiles" 
            :key="file.id"
            class="file-item"
          >
            <div class="file-info">
              <div class="file-name-row">
                <span class="file-name">{{ getFileName(file.filePath) }}</span>
                <!-- 特殊文件夹标识 -->
                <div v-if="file.isDirectory && file.isSpecialFolder" class="folder-tags">
                  <el-tag 
                    :type="getFolderTypeColor(file.folderType)" 
                    size="small"
                    effect="dark"
                  >
                    {{ getFolderTypeLabel(file.folderType) }}
                  </el-tag>
                  <el-tag 
                    v-if="file.isMultiDisc && file.discNumber" 
                    type="info" 
                    size="small"
                  >
                    碟片 {{ file.discNumber }}
                  </el-tag>
                </div>
              </div>
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
  background-color: var(--color-background-soft);
}

/* 头部区域 */
.header-section {
  margin-bottom: 24px;
}

.back-button {
  background: var(--color-background);
  border: 1px solid var(--color-border);
}

/* 加载状态 */
.loading-container {
  background: var(--color-background);
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
  background: var(--color-background);
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
  background-color: var(--color-background-soft);
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
  color: var(--color-heading);
  line-height: 1.3;
}

.original-title {
  margin: 0;
  font-size: 16px;
  color: var(--color-text);
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
  color: var(--color-text);
}

.description-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-heading);
}

.description {
  margin: 0;
  font-size: 14px;
  color: var(--color-text);
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
  color: var(--color-text);
}

/* 区块标题 */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-heading);
}

/* 文件列表 */
.files-section {
  background: var(--color-background);
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

/* 父文件夹列表 */
.parent-folders-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 20px;
}

.parent-folder-group {
  border: 2px solid var(--el-color-warning);
  border-radius: 12px;
  overflow: hidden;
  background: var(--color-background-soft);
}

.parent-folder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(to right, var(--el-color-warning-light-9), var(--color-background));
  border-bottom: 1px solid var(--el-color-warning-light-7);
}

.parent-folder-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.folder-icon {
  flex-shrink: 0;
}

.parent-folder-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-heading);
  word-break: break-all;
}

.parent-folder-actions {
  flex-shrink: 0;
  margin-left: 16px;
}

.child-folders-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.child-file-item {
  margin: 0;
  border-radius: 0;
  border: none;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background);
}

.child-file-item:last-child {
  border-bottom: none;
}

.child-file-item:hover {
  background: var(--color-background-mute);
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
  background: var(--color-background-soft);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-heading);
  word-break: break-all;
}

.folder-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.file-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--color-text);
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
  background: var(--color-background);
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
  background: var(--color-background-soft);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--color-border);
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
  background-color: var(--color-background-mute);
}

.episode-info {
  flex: 1;
  padding: 12px;
  min-width: 0;
}

.episode-number {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-primary);
  margin-bottom: 2px;
}

.episode-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-heading);
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
  color: var(--color-text);
  margin-bottom: 4px;
}

.episode-description {
  font-size: 11px;
  color: var(--color-text);
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
