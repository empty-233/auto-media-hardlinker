<template>
  <div class="media-detail-view">
    <el-button @click="goBack" class="back-button" type="primary" plain>
      <el-icon><el-icon-arrow-left /></el-icon> 返回
    </el-button>

    <div v-loading="loading">
      <div v-if="media" class="detail-content">
        <el-row :gutter="20">
          <el-col :xs="24" :sm="8" :md="6" :lg="5">
            <div class="poster-container">
              <img :src="getImageUrl(media.posterUrl) || defaultPoster" :alt="media.title" class="poster-image" />
            </div>
          </el-col>
          <el-col :xs="24" :sm="16" :md="18" :lg="19">
            <div class="media-header">
              <h1>{{ media.title }}</h1>
              <el-tag :type="getTypeTag(media.type)" size="large" class="type-tag">
                {{ getTypeLabel(media.type) }}
              </el-tag>
            </div>
            
            <div class="media-meta">
              <div class="meta-item" v-if="media.originalTitle">
                <span class="label">原始标题：</span>
                <span>{{ media.originalTitle }}</span>
              </div>
              <div class="meta-item" v-if="media.releaseDate">
                <span class="label">发布日期：</span>
                <span>{{ formatDate(media.releaseDate) }}</span>
              </div>
              <div class="meta-item">
                <span class="label">TMDB ID：</span>
                <span>{{ media.tmdbId }}</span>
              </div>
              <div class="meta-item">
                <span class="label">添加时间：</span>
                <span>{{ formatDate(media.createdAt) }}</span>
              </div>
            </div>
            
            <div class="media-description" v-if="media.description">
              <h3>简介</h3>
              <p>{{ media.description }}</p>
            </div>
          </el-col>
        </el-row>

        <!-- 文件列表 -->
        <div class="files-section">
          <h2>关联文件 ({{ media.files.length }})</h2>
          <div class="table-container">
            <el-table :data="media.files" :max-height="tableMaxHeight" :size="isMobileView ? 'small' : 'default'">
              <el-table-column label="文件名" min-width="180" :show-overflow-tooltip="true">
                <template #default="scope">
                  {{ getFileName(scope.row.filePath) }}
                </template>
              </el-table-column>
              <el-table-column prop="fileSize" label="大小" width="120" :show-overflow-tooltip="true">
                <template #default="scope">
                  {{ formatSize(scope.row.fileSize) }}
                </template>
              </el-table-column>
              <el-table-column prop="createdAt" label="添加日期" width="180" class="date-column" :show-overflow-tooltip="true">
                <template #default="scope">
                  {{ formatDate(scope.row.createdAt) }}
                </template>
              </el-table-column>
              <el-table-column label="路径" min-width="120">
                <template #default="scope">
                  <div class="path-actions">
                    <el-tooltip :content="scope.row.filePath" placement="top" :disabled="isMobileView">
                      <el-button type="info" plain size="small">
                        原始路径
                      </el-button>
                    </el-tooltip>
                    <el-tooltip :content="scope.row.linkPath" placement="top" :disabled="isMobileView">
                      <el-button type="success" plain size="small">
                        硬链接路径
                      </el-button>
                    </el-tooltip>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>

        <!-- 电视剧特有信息 -->
        <div v-if="media.type === 'tv' && media.tvInfos" class="tv-section">
          <h2>剧集信息</h2>
          <div class="table-container">
            <el-table 
              v-if="media.tvInfos.episodes && media.tvInfos.episodes.length > 0"
              :data="media.tvInfos.episodes" 
              :max-height="tableMaxHeight"
              :size="isMobileView ? 'small' : 'default'"
            >
              <el-table-column prop="id" label="ID" width="60" />
              <el-table-column label="海报" width="80" class="poster-column">
                <template #default="scope">
                  <el-image 
                    v-if="scope.row.posterUrl" 
                    :src="getImageUrl(scope.row.posterUrl)" 
                    fit="cover" 
                    style="width: 60px; height: 40px;"
                  />
                  <div v-else class="no-image">无图片</div>
                </template>
              </el-table-column>
              <el-table-column label="信息" min-width="180">
                <template #default="scope">
                  <div class="episode-info">
                    <div class="episode-title">
                      剧集 #{{ scope.row.episodeNumber || '?' }}
                      <el-button size="small" type="primary" text @click="openEditEpisodeDialog(scope.row)">
                        <el-icon><el-icon-edit /></el-icon>
                      </el-button>
                    </div>
                    <div class="episode-title" v-if="scope.row.title">{{ scope.row.title }}</div>
                    <div class="episode-date" v-if="scope.row.releaseDate">
                      {{ formatDate(scope.row.releaseDate) }}
                    </div>
                    <div class="episode-desc" v-if="scope.row.description">
                      {{ scope.row.description }}
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="关联文件" width="100">
                <template #default="scope">
                  <el-button 
                    v-if="scope.row.fileId" 
                    type="primary" 
                    size="small"
                    @click="viewFileDetails(scope.row.fileId)"
                  >
                    查看文件
                  </el-button>
                  <span v-else>无关联</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <el-empty v-if="!media.tvInfos.episodes || media.tvInfos.episodes.length === 0" description="没有剧集信息" />
        </div>
      </div>
      
      <el-empty v-else-if="!loading" description="未找到媒体信息" />
    </div>
    
    <!-- 编辑剧集信息对话框 -->
    <el-dialog
      v-model="editEpisodeDialogVisible"
      title="编辑剧集信息"
      width="500px"
    >
      <el-form :model="editingEpisode" label-width="80px">
        <el-form-item label="剧集编号">
          <el-input-number v-model="editingEpisode.episodeNumber" :min="1" />
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="editingEpisode.title" placeholder="请输入剧集标题" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input 
            v-model="editingEpisode.description" 
            type="textarea" 
            placeholder="请输入剧集描述"
            :rows="4"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="editEpisodeDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveEpisodeInfo" :loading="saveLoading">
            保存
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft as ElIconArrowLeft, Edit as ElIconEdit } from '@element-plus/icons-vue'
import { api, getImageUrl } from '../api'
import type { Media, EpisodeInfo } from '../api'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const loading = ref(true)
const media = ref<Media | null>(null)
const defaultPoster = 'https://via.placeholder.com/300x450?text=No+Poster'
const tableMaxHeight = ref('400px')
const isMobileView = ref(false)
const editEpisodeDialogVisible = ref(false)
const saveLoading = ref(false)
const editingEpisode = reactive<{
  id?: number,
  episodeNumber: number,
  title: string,
  description: string
}>({
  episodeNumber: 1,
  title: '',
  description: ''
})

// 类型标签和显示名称
const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    tv: '电视剧',
    movie: '电影',
    collection: '合集'
  }
  return labels[type] || type
}

const getTypeTag = (type: string) => {
  const tags: Record<string, string> = {
    tv: 'success',
    movie: 'primary',
    collection: 'warning'
  }
  return tags[type] || ''
}

// 格式化日期
const formatDate = (dateString: string) => {
  if (!dateString) return '未知'
  const date = new Date(dateString)
  
  if (isMobileView.value) {
    // 在移动设备上使用更简短的格式
    return date.toLocaleDateString('zh-CN')
  }
  
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

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

// 获取文件名
const getFileName = (filePath: string) => {
  if (!filePath) return '未知文件'
  return filePath.split('/').pop() || filePath.split('\\').pop() || filePath
}

// 返回上一页
const goBack = () => {
  router.back()
}

// 查看文件详情
const viewFileDetails = (fileId: number) => {
  router.push(`/files?id=${fileId}`)
}

// 检测屏幕尺寸变化
const checkScreenSize = () => {
  isMobileView.value = window.innerWidth <= 768
  
  // 动态调整表格高度
  if (window.innerWidth <= 768) {
    tableMaxHeight.value = '300px'
  } else {
    tableMaxHeight.value = '400px'
  }
}

// 打开编辑剧集对话框
const openEditEpisodeDialog = (episode: EpisodeInfo) => {
  editingEpisode.id = episode.id
  editingEpisode.episodeNumber = episode.episodeNumber || 0
  editingEpisode.title = episode.title || ''
  editingEpisode.description = episode.description || ''
  editEpisodeDialogVisible.value = true
}

// 保存剧集信息
const saveEpisodeInfo = async () => {
  if (!editingEpisode.id) {
    ElMessage.error('没有找到剧集ID')
    return
  }
  
  saveLoading.value = true
  try {
    await api.updateEpisode(editingEpisode.id, {
      title: editingEpisode.title,
      description: editingEpisode.description,
      episodeNumber: editingEpisode.episodeNumber
    })
    
    // 更新成功后，更新本地数据
    if (media.value?.tvInfos?.episodes) {
      const index = media.value.tvInfos.episodes.findIndex(ep => ep.id === editingEpisode.id)
      if (index !== -1) {
        media.value.tvInfos.episodes[index].title = editingEpisode.title
        media.value.tvInfos.episodes[index].description = editingEpisode.description
        media.value.tvInfos.episodes[index].episodeNumber = editingEpisode.episodeNumber
      }
    }
    
    ElMessage.success('剧集信息已更新')
    editEpisodeDialogVisible.value = false
  } catch (error) {
    console.error('更新剧集信息失败:', error)
    ElMessage.error('更新剧集信息失败')
  } finally {
    saveLoading.value = false
  }
}

// 初始化加载数据
onMounted(async () => {
  const mediaId = parseInt(route.params.id as string)
  if (isNaN(mediaId)) {
    router.push('/media')
    return
  }

  try {
    const response = await api.getMediaById(mediaId)
    media.value = response.data
  } catch (error) {
    console.error('获取媒体详情失败:', error)
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
.media-detail-view {
  padding: 20px;
}

.back-button {
  margin-bottom: 20px;
}

.detail-content {
  margin-top: 20px;
}

.poster-container {
  margin-bottom: 20px;
}

.poster-image {
  width: 100%;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.media-header {
  display: flex;
  align-items: flex-start;
  margin-bottom: 20px;
  gap: 15px;
  flex-wrap: wrap;
}

.media-header h1 {
  margin: 0;
}

.type-tag {
  margin-top: 5px;
}

.media-meta {
  margin-bottom: 20px;
}

.meta-item {
  margin-bottom: 8px;
}

.label {
  font-weight: bold;
  color: #666;
}

.media-description {
  margin-bottom: 30px;
  border-top: 1px solid #eee;
  padding-top: 20px;
}

.files-section,
.tv-section {
  margin-top: 40px;
  border-top: 1px solid #eee;
  padding-top: 20px;
}

.table-container {
  overflow-x: auto;
}

.path-actions {
  display: flex;
  gap: 8px;
}

.no-image {
  width: 60px;
  height: 40px;
  background-color: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #999;
}

.episode-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.episode-title {
  font-weight: bold;
}

.episode-date {
  font-size: 12px;
  color: #666;
}

.episode-desc {
  font-size: 13px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* 移动端响应式调整 */
@media (max-width: 768px) {
  .media-detail-view {
    padding: 10px;
  }
  
  .media-header {
    gap: 10px;
  }
  
  .media-header h1 {
    font-size: 1.5rem;
  }
  
  .date-column {
    display: none;
  }
  
  .poster-column {
    display: none;
  }
  
  .path-actions {
    flex-direction: column;
    gap: 5px;
  }
  
  .episode-desc {
    -webkit-line-clamp: 1;
  }
}
</style>