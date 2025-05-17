<template>
  <div class="media-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <h2>媒体库</h2>
          <div class="filter-actions">
            <el-radio-group v-model="currentType" @change="filterByType">
              <el-radio-button label="all">全部</el-radio-button>
              <el-radio-button label="tv">电视剧</el-radio-button>
              <el-radio-button label="movie">电影</el-radio-button>
              <el-radio-button label="collection">合集</el-radio-button>
            </el-radio-group>
            <el-input
              v-model="searchQuery"
              placeholder="搜索标题..."
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
        <div v-if="filteredMedia.length === 0 && !loading" class="no-data">
          <el-empty description="没有找到媒体" />
        </div>

        <el-row :gutter="20">
          <el-col
            v-for="item in filteredMedia"
            :key="item.id"
            :xs="24"
            :sm="12"
            :md="8"
            :lg="6"
            :xl="4"
          >
            <el-card class="media-card" @click="goToDetail(item.id)">
              <div class="media-poster">
                <img
                  :src="getImageUrl(item.posterUrl)"
                  :alt="item.title"
                  class="poster-image"
                />
                <div class="media-type">
                  <el-tag :type="getTypeTag(item.type)">{{ getTypeLabel(item.type) }}</el-tag>
                </div>
              </div>
              <div class="media-info">
                <h3 class="media-title">{{ item.title }}</h3>
                <p v-if="item.releaseDate" class="media-date">
                  {{ new Date(item.releaseDate).getFullYear() }}
                </p>
                <p class="media-files">{{ item.files.length }} 个文件</p>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <div class="pagination-container">
          <el-pagination
            v-if="filteredMedia.length > 0"
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[12, 24, 36, 48]"
            layout="total, sizes, prev, pager, next"
            :total="totalItems"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Search as ElIconSearch } from '@element-plus/icons-vue'
import { api, getImageUrl } from '../api'
import type { Media } from '../api'

const router = useRouter()
const loading = ref(true)
const allMedia = ref<Media[]>([])
const searchQuery = ref('')
const currentType = ref('all')
const currentPage = ref(1)
const pageSize = ref(12)

// 根据当前页码和每页数量计算当前显示的媒体列表
const filteredMedia = computed(() => {
  let result = [...allMedia.value]

  // 类型过滤
  if (currentType.value !== 'all') {
    result = result.filter(item => item.type === currentType.value)
  }

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      item =>
        item.title.toLowerCase().includes(query) ||
        (item.originalTitle && item.originalTitle.toLowerCase().includes(query))
    )
  }

  // 计算分页
  const startIndex = (currentPage.value - 1) * pageSize.value
  const endIndex = startIndex + pageSize.value

  return result.slice(startIndex, endIndex)
})

// 计算总条目数
const totalItems = computed(() => {
  let result = [...allMedia.value]

  // 类型过滤
  if (currentType.value !== 'all') {
    result = result.filter(item => item.type === currentType.value)
  }

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      item =>
        item.title.toLowerCase().includes(query) ||
        (item.originalTitle && item.originalTitle.toLowerCase().includes(query))
    )
  }

  return result.length
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

// 导航到详情页
const goToDetail = (id: number) => {
  router.push(`/media/${id}`)
}

// 处理类型过滤
const filterByType = () => {
  currentPage.value = 1 // 重置到第一页
}

// 处理搜索
const handleSearch = () => {
  currentPage.value = 1 // 重置到第一页
}

// 分页处理
const handleSizeChange = (size: number) => {
  pageSize.value = size
  currentPage.value = 1 // 重置到第一页
}

const handleCurrentChange = (page: number) => {
  currentPage.value = page
}

// 初始化加载数据
onMounted(async () => {
  try {
    const response = await api.getAllMedia()
    allMedia.value = response.data
  } catch (error) {
    console.error('获取媒体列表失败:', error)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.media-view {
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
  gap: 15px;
  align-items: center;
  flex-wrap: wrap;
}

.search-input {
  width: 100%;
  max-width: 250px;
}

.media-card {
  margin-bottom: 20px;
  transition: transform 0.3s;
  cursor: pointer;
  height: 100%;
}

.media-card:hover {
  transform: translateY(-5px);
}

.media-poster {
  position: relative;
  margin-bottom: 10px;
}

.poster-image {
  width: 100%;
  height: auto;
  aspect-ratio: 2/3;
  object-fit: cover;
  border-radius: 4px;
}

.media-type {
  position: absolute;
  top: 10px;
  right: 10px;
}

.media-info {
  padding: 10px 0;
}

.media-title {
  margin: 0 0 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.media-date,
.media-files {
  margin: 5px 0;
  color: #666;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.no-data {
  padding: 40px 0;
}

/* 移动端响应式调整 */
@media (max-width: 768px) {
  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .search-input {
    max-width: 100%;
  }

  .el-radio-group {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
  }

  .el-radio-button {
    flex-grow: 1;
    text-align: center;
  }
}

/* 平板电脑媒体卡片调整 */
@media (max-width: 992px) and (min-width: 769px) {
  .poster-image {
    aspect-ratio: 3/4;
  }
}
</style>