<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Picture, Document } from '@element-plus/icons-vue'
import ResponsivePagination from '@/components/common/ResponsivePagination.vue'
import { MediaService } from '@/api/media'
import type { Media, MediaType, MediaPaginationParams } from '@/api/media/types'
import { MediaType as MediaTypeEnum } from '@/api/media/types'

// 定义组件名称以支持 keep-alive
defineOptions({
  name: 'MediaListView',
})

// 路由
const router = useRouter()

// 响应式数据
const loading = ref(false)
const mediaList = ref<Media[]>([])
const searchKeyword = ref('')
const selectedType = ref<MediaType | ''>('')
const currentPage = ref(1)
const pageSize = ref(10)
const totalCount = ref(0)

// 方法
const loadMediaList = async () => {
  try {
    loading.value = true
    const params: MediaPaginationParams = {
      page: currentPage.value,
      limit: pageSize.value,
      keyword: searchKeyword.value,
    }
    const res = selectedType.value
      ? await MediaService.getMediaByType(selectedType.value, params)
      : await MediaService.getAllMedia(params)

    mediaList.value = res.items
    totalCount.value = res.total
  } catch (error) {
    console.error('加载媒体列表失败:', error)
    ElMessage.error('加载媒体列表失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

const refreshData = () => {
  currentPage.value = 1
  searchKeyword.value = ''
  loadMediaList()
}

const handleSearch = useDebounceFn(() => {
  currentPage.value = 1
  loadMediaList()
}, 500)

const handleTypeFilter = (tab: any) => {
  currentPage.value = 1
  const type = tab.props.name as MediaType | ''
  selectedType.value = type
  loadMediaList()
}


const goToDetail = (id: number) => {
  router.push(`/media/detail/${id}`)
}

const getTypeLabel = (type: MediaType): string => {
  const labels = {
    tv: '电视剧',
    movie: '电影',
    collection: '合集',
  }
  return labels[type] || type
}

const getTypeTagType = (type: MediaType) => {
  const types = {
    tv: 'primary',
    movie: 'success',
    collection: 'warning',
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

// 生命周期
onMounted(() => {
  loadMediaList()
})
</script>

<template>
  <div class="media-list-view">
    <!-- 头部操作区 -->
    <div class="header-section">
      <div class="title-section">
        <h1 class="page-title">媒体库</h1>
        <p class="page-description">共 {{ totalCount }} 个媒体内容</p>
      </div>

      <!-- 搜索和筛选 -->
      <div class="filter-section">
        <div>
          <el-input
            v-model="searchKeyword"
            placeholder="搜索媒体标题..."
            :prefix-icon="Search"
            clearable
            class="search-input"
            @input="handleSearch"
          />
          <el-button type="primary" :icon="Refresh" @click="refreshData" :loading="loading">
            刷新
          </el-button>
        </div>
        <div>
          <el-tabs v-model="selectedType" class="type-tabs" @tab-click="handleTypeFilter">
            <el-tab-pane label="媒体列表" name="" />
            <el-tab-pane label="电视剧" :name="MediaTypeEnum.TV" />
            <el-tab-pane label="电影" :name="MediaTypeEnum.MOVIE" />
            <el-tab-pane label="合集" :name="MediaTypeEnum.COLLECTION" />
          </el-tabs>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading && mediaList.length === 0" class="loading-container">
      <el-skeleton :rows="3" animated />
      <el-skeleton :rows="3" animated />
      <el-skeleton :rows="3" animated />
    </div>

    <!-- 空状态 -->
    <el-empty
      v-else-if="!loading && mediaList.length === 0"
      description="暂无媒体内容"
      class="empty-state"
    >
      <el-button type="primary" @click="refreshData">立即刷新</el-button>
    </el-empty>

    <!-- 媒体卡片网格 -->
    <div v-else class="media-grid">
      <div
        v-for="media in mediaList"
        :key="media.id"
        class="media-card"
        @click="goToDetail(media.id)"
      >
        <!-- 海报图片 -->
        <div class="poster-container">
          <el-image
            :src="media.posterUrl || '/images/placeholder.svg'"
            :alt="media.title"
            class="poster-image"
            fit="cover"
            loading="lazy"
          >
            <template #error>
              <div class="poster-placeholder">
                <el-icon size="40" color="#c0c4cc">
                  <Picture />
                </el-icon>
              </div>
            </template>
          </el-image>

          <!-- 媒体类型标签 -->
          <div class="media-type-tag">
            <el-tag :type="getTypeTagType(media.type)" size="small" effect="dark">
              {{ getTypeLabel(media.type) }}
            </el-tag>
          </div>
        </div>

        <!-- 卡片内容 -->
        <div class="card-content">
          <h3 class="media-title" :title="media.title">
            {{ media.title }}
          </h3>

          <p v-if="media.originalTitle" class="original-title" :title="media.originalTitle">
            {{ media.originalTitle }}
          </p>

          <p v-if="media.releaseDate" class="release-date">
            {{ formatDate(media.releaseDate) }}
          </p>

          <p v-if="media.description" class="description" :title="media.description">
            {{ media.description }}
          </p>

          <!-- 文件统计 -->
          <div class="file-stats">
            <el-icon class="stats-icon"><Document /></el-icon>
            <span>{{ media.files?.length || 0 }} 个文件</span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="card-actions">
          <el-button type="primary" size="small" @click.stop="goToDetail(media.id)">
            查看详情
          </el-button>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <ResponsivePagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :total="totalCount"
      @change="loadMediaList"
    />
  </div>
</template>

<style scoped>
.media-list-view {
  padding: 24px;
  min-height: 100%;
  background-color: #f5f7fa;
}

/* 头部区域 */
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
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

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}

.search-input {
  width: 280px;
}

.type-select {
  width: 120px;
}

.filter-section > div:first-child {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-section > div:last-child {
  width: 100%;
}

/* 加载状态 */
.loading-container {
  background: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 空状态 */
.empty-state {
  background: white;
  padding: 60px 24px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 媒体网格 */
.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

/* 媒体卡片 */
.media-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
}

.media-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

/* 海报容器 */
.poster-container {
  position: relative;
  width: 100%;
  height: 400px;
  overflow: hidden;
}

.poster-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
}

.media-type-tag {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
}

/* 卡片内容 */
.card-content {
  padding: 16px;
}

.media-title {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.original-title {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #909399;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.release-date {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #606266;
}

.description {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.file-stats {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #909399;
}

.stats-icon {
  font-size: 14px;
}

/* 卡片操作 */
.card-actions {
  padding: 0 16px 16px 16px;
}

.card-actions .el-button {
  width: 100%;
}


/* 响应式设计 */
@media (max-width: 768px) {
  .media-list-view {
    padding: 16px;
  }

  .header-section {
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }

  .filter-section {
    width: 100%;
    flex-wrap: wrap;
  }

  .search-input {
    width: 100%;
    margin-bottom: 8px;
  }

  .type-select {
    flex: 1;
    min-width: 100px;
  }

  .media-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }

  .poster-container {
    height: 320px;
  }
}

@media (max-width: 480px) {
  .media-grid {
    grid-template-columns: 1fr;
  }

  .poster-container {
    height: 280px;
  }
}
</style>
