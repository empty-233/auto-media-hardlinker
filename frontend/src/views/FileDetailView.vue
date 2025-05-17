<template>
  <div class="file-detail-view">
    <el-button @click="goBack" class="back-button" type="primary" plain>
      <el-icon><el-icon-arrow-left /></el-icon> 返回
    </el-button>

    <div v-loading="loading">
      <el-card v-if="file" class="file-card">
        <template #header>
          <div class="card-header">
            <h2>文件详情</h2>
          </div>
        </template>

        <el-descriptions :column="descriptionColumns" border>
          <el-descriptions-item label="文件名">
            {{ getFileName(file.filePath) }}
          </el-descriptions-item>
          <el-descriptions-item label="大小">
            {{ formatFileSize(file.fileSize) }}
          </el-descriptions-item>
          <el-descriptions-item label="文件路径" :span="descriptionColumns">
            <el-text class="path-text" :content="file.filePath" />
          </el-descriptions-item>
          <el-descriptions-item label="硬链接路径" :span="descriptionColumns" v-if="file.linkPath">
            <el-text class="path-text" :content="file.linkPath" />
          </el-descriptions-item>
          <el-descriptions-item label="设备ID">
            {{ file.deviceId }}
          </el-descriptions-item>
          <el-descriptions-item label="Inode">
            {{ file.inode }}
          </el-descriptions-item>
          <el-descriptions-item label="文件哈希" v-if="file.fileHash">
            {{ file.fileHash }}
          </el-descriptions-item>
          <el-descriptions-item label="添加时间">
            {{ formatDateTime(file.createdAt) }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 关联媒体信息 -->
        <div v-if="file.Media" class="media-section">
          <h3>关联媒体</h3>
          
          <el-row :gutter="20" class="media-info">
            <el-col :xs="24" :sm="8" :md="6" :lg="4" :xl="3">
              <div class="media-poster">
                <img 
                  :src="getImageUrl(file.Media.posterUrl)" 
                  :alt="file.Media.title" 
                  class="poster-image"
                  @click="goToMedia(file.Media.id)"
                />
              </div>
            </el-col>
            
            <el-col :xs="24" :sm="16" :md="18" :lg="20" :xl="21">
              <div class="media-details">
                <h2 class="media-title" @click="goToMedia(file.Media.id)">
                  {{ file.Media.title }}
                  <el-tag size="small" :type="getTypeTag(file.Media.type)">{{ getTypeLabel(file.Media.type) }}</el-tag>
                </h2>
                
                <p v-if="file.Media.originalTitle && file.Media.originalTitle !== file.Media.title" class="original-title">
                  {{ file.Media.originalTitle }}
                </p>
                
                <p v-if="file.Media.releaseDate" class="release-date">
                  发行日期: {{ formatDate(file.Media.releaseDate) }}
                </p>
                
                <p class="description" v-if="file.Media.description">
                  {{ truncate(file.Media.description, 300) }}
                </p>
                
                <!-- 剧集信息 -->
                <div v-if="file.episode && file.Media.type === 'tv'" class="episode-info">
                  <h4>剧集信息</h4>
                  <el-descriptions border :column="1" size="small">
                    <el-descriptions-item label="剧集ID">
                      {{ file.episode.id }}
                    </el-descriptions-item>
                    <el-descriptions-item label="TMDB ID" v-if="file.episode.tmdbId">
                      {{ file.episode.tmdbId }}
                    </el-descriptions-item>
                    <el-descriptions-item label="描述" v-if="file.episode.description">
                      {{ file.episode.description }}
                    </el-descriptions-item>
                    <el-descriptions-item label="截图" v-if="file.episode.posterUrl">
                      <el-image 
                        :src="getImageUrl(file.episode.posterUrl)" 
                        fit="cover"
                        :preview-src-list="[getImageUrl(file.episode.posterUrl)]"
                        style="width: 200px; height: auto;"
                      />
                    </el-descriptions-item>
                  </el-descriptions>
                </div>
                
                <el-button type="primary" @click="goToMedia(file.Media.id)" class="view-media-btn">
                  查看媒体详情
                </el-button>
              </div>
            </el-col>
          </el-row>
        </div>
      </el-card>

      <div v-else-if="!loading" class="not-found">
        <el-empty description="未找到文件" />
        <el-button type="primary" @click="goBack">返回</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft as ElIconArrowLeft } from '@element-plus/icons-vue'
import { api, getImageUrl } from '../api'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const file = ref<any>(null)
const descriptionColumns = ref(2)

// 初始化数据
onMounted(async () => {
  const fileId = route.query.id ? Number(route.query.id) : null
  
  // 检查是否有文件ID
  if (!fileId) {
    ElMessage.error('未提供文件ID')
    router.push('/files')
    return
  }
  
  try {
    const response = await api.getFileById(fileId)
    file.value = response.data
    console.log('文件详情:', file.value)
    
    // 根据屏幕宽度设置描述列数
    updateColumnCount()
    window.addEventListener('resize', updateColumnCount)
  } catch (error) {
    console.error('获取文件详情失败:', error)
    ElMessage.error('获取文件详情失败')
  } finally {
    loading.value = false
  }
})

// 在组件销毁时移除事件监听
onUnmounted(() => {
  window.removeEventListener('resize', updateColumnCount)
})

// 根据屏幕宽度更新列数
const updateColumnCount = () => {
  if (window.innerWidth < 768) {
    descriptionColumns.value = 1
  } else {
    descriptionColumns.value = 2
  }
}

// 获取文件名
const getFileName = (filePath: string) => {
  if (!filePath) return '未知文件'
  return filePath.split('/').pop() || filePath.split('\\').pop() || filePath
}

// 格式化文件大小
const formatFileSize = (size: string) => {
  const sizeNum = parseInt(size, 10)
  if (isNaN(sizeNum)) return '未知大小'

  if (sizeNum < 1024) return `${sizeNum} B`
  if (sizeNum < 1024 * 1024) return `${(sizeNum / 1024).toFixed(2)} KB`
  if (sizeNum < 1024 * 1024 * 1024) return `${(sizeNum / (1024 * 1024)).toFixed(2)} MB`
  return `${(sizeNum / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// 格式化日期时间
const formatDateTime = (dateTimeString: string) => {
  if (!dateTimeString) return '未知时间'
  const date = new Date(dateTimeString)
  return date.toLocaleString()
}

// 格式化日期（仅日期部分）
const formatDate = (dateString: string) => {
  if (!dateString) return '未知日期'
  const date = new Date(dateString)
  return date.toLocaleDateString()
}

// 截断文本
const truncate = (text: string, length: number) => {
  if (!text) return ''
  return text.length > length ? text.substring(0, length) + '...' : text
}

// 获取媒体类型标签
const getTypeLabel = (type: string) => {
  const labels = {
    tv: '电视剧',
    movie: '电影',
    collection: '合集'
  } as { [key: string]: string }
  return labels[type] || type
}

// 获取媒体类型对应的标签样式
const getTypeTag = (type: string) => {
  const tags = {
    tv: 'success',
    movie: 'primary',
    collection: 'warning'
  } as { [key: string]: string }
  return tags[type] || ''
}

// 返回上一页
const goBack = () => {
  router.back()
}

// 跳转到媒体详情
const goToMedia = (mediaId: number) => {
  router.push(`/media/${mediaId}`)
}
</script>

<style scoped>
.file-detail-view {
  padding: 20px;
}

.back-button {
  margin-bottom: 20px;
}

.file-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.path-text {
  word-break: break-all;
  display: block;
}

.media-section {
  margin-top: 30px;
  border-top: 1px solid #eee;
  padding-top: 20px;
}

.media-info {
  margin-top: 20px;
}

.media-poster {
  margin-bottom: 20px;
}

.poster-image {
  width: 100%;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.3s;
}

.poster-image:hover {
  transform: scale(1.03);
}

.media-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.media-title {
  margin-top: 0;
  margin-bottom: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.media-title:hover {
  text-decoration: underline;
}

.original-title {
  color: #666;
  margin-top: 0;
  font-style: italic;
}

.release-date {
  color: #666;
}

.description {
  margin-top: 10px;
  line-height: 1.6;
}

.episode-info {
  margin-top: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
  padding: 15px;
}

.episode-info h4 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #409EFF;
}

.view-media-btn {
  align-self: flex-start;
  margin-top: 20px;
}

.not-found {
  text-align: center;
  padding: 50px 0;
}

@media (max-width: 768px) {
  .file-detail-view {
    padding: 10px;
  }
  
  .card-header h2 {
    font-size: 1.5rem;
  }
}
</style>