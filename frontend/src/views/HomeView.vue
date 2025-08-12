<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { DashboardService } from '@/api'
import type { DashboardStats } from '@/api'

// 路由
const router = useRouter()

// 响应式数据
const dashboardStats = ref<DashboardStats | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

// 获取仪表板数据
const fetchDashboardData = async () => {
  try {
    loading.value = true
    error.value = null
    dashboardStats.value = await DashboardService.getDashboardStats()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '获取数据失败'
    console.error('获取仪表板数据失败:', err)
  } finally {
    loading.value = false
  }
}

// 格式化数字显示
const formatNumber = (num: number): string => {
  return num.toLocaleString()
}

// 格式化存储空间显示
const formatStorage = (tb: number): string => {
  if (tb >= 1) {
    return `${tb.toFixed(2)} TB`
  } else if (tb * 1024 >= 1) {
    return `${(tb * 1024).toFixed(2)} GB`
  } else {
    return `${(tb * 1024 * 1024).toFixed(0)} MB`
  }
}

// 格式化日期显示
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric'
  })
}

// 跳转到媒体详情页面
const goToMediaDetail = (mediaId: number) => {
  router.push(`/media/detail/${mediaId}`)
}

// 组件挂载时获取数据
onMounted(() => {
  fetchDashboardData()
})
</script>

<template>
  <div class="home-view">
    <div class="welcome-section">
      <h1>欢迎使用 Auto Media Hardlinker</h1>
    </div>
    
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-section">
      <el-skeleton animated>
        <template #template>
          <div class="skeleton-stats">
            <div v-for="i in 6" :key="i" class="skeleton-stat-card">
              <el-skeleton-item variant="circle" style="width: 60px; height: 60px" />
              <div class="skeleton-content">
                <el-skeleton-item variant="text" style="width: 80px; height: 20px" />
                <el-skeleton-item variant="text" style="width: 60px; height: 24px; margin-top: 5px" />
              </div>
            </div>
          </div>
          
          <div class="skeleton-media-section">
            <el-skeleton-item variant="text" style="width: 150px; height: 32px; margin-bottom: 20px" />
            <div class="skeleton-media-grid">
              <div v-for="i in 6" :key="i" class="skeleton-media-card">
                <el-skeleton-item variant="image" style="width: 100%; height: 120px" />
                <div class="skeleton-media-info">
                  <el-skeleton-item variant="text" style="width: 100%; height: 20px" />
                  <el-skeleton-item variant="text" style="width: 60px; height: 16px; margin-top: 8px" />
                  <el-skeleton-item variant="text" style="width: 80px; height: 16px; margin-top: 5px" />
                  <el-skeleton-item variant="text" style="width: 50px; height: 16px; margin-top: 5px" />
                </div>
              </div>
            </div>
          </div>
        </template>
      </el-skeleton>
    </div>
    
    <!-- 错误状态 -->
    <div v-else-if="error" class="error-section">
      <el-result
        icon="warning"
        title="加载失败"
        :sub-title="error"
      >
        <template #extra>
          <el-button type="primary" @click="fetchDashboardData">
            重试
          </el-button>
        </template>
      </el-result>
    </div>
    
    <!-- 数据展示 -->
    <template v-else-if="dashboardStats">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📁</div>
          <div class="stat-content">
            <h3>文件总数</h3>
            <p class="stat-number">{{ formatNumber(dashboardStats.totalFiles) }}</p>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">🎬</div>
          <div class="stat-content">
            <h3>媒体总数</h3>
            <p class="stat-number">{{ formatNumber(dashboardStats.totalMedia) }}</p>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">📺</div>
          <div class="stat-content">
            <h3>电视剧</h3>
            <p class="stat-number">{{ formatNumber(dashboardStats.typeStats.tv) }}</p>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">🎭</div>
          <div class="stat-content">
            <h3>电影</h3>
            <p class="stat-number">{{ formatNumber(dashboardStats.typeStats.movie) }}</p>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">📚</div>
          <div class="stat-content">
            <h3>合集</h3>
            <p class="stat-number">{{ formatNumber(dashboardStats.typeStats.collection) }}</p>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">💾</div>
          <div class="stat-content">
            <h3>存储空间</h3>
            <p class="stat-number">{{ formatStorage(dashboardStats.totalStorageTB) }}</p>
            <p class="stat-subtitle">使用率 {{ dashboardStats.storageUsagePercent.toFixed(1) }}%</p>
          </div>
        </div>
      </div>
      
      <!-- 最近添加的媒体 -->
      <div class="recent-media-section" v-if="dashboardStats.recentMedia.length > 0">
        <h2>最近添加的媒体</h2>
        <div class="media-grid">
          <div 
            v-for="media in dashboardStats.recentMedia" 
            :key="media.id" 
            class="media-card"
            @click="goToMediaDetail(media.id)"
          >
            <div class="media-poster">
              <img v-if="media.posterUrl" :src="media.posterUrl" :alt="media.title" />
              <div v-else class="poster-placeholder">
                <span v-if="media.type === 'tv'">📺</span>
                <span v-else-if="media.type === 'movie'">🎬</span>
                <span v-else>📚</span>
              </div>
            </div>
            <div class="media-info">
              <h3>{{ media.title }}</h3>
              <p class="media-type">{{ media.type === 'tv' ? '电视剧' : media.type === 'movie' ? '电影' : '合集' }}</p>
              <p class="media-files">{{ media._count.files }} 个文件</p>
              <p class="media-date">{{ formatDate(media.createdAt) }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>
    
    <div class="feature-section">
      <h2>主要功能</h2>
      <div class="feature-grid">
        <div class="feature-card">
          <h3>🤖 智能解析</h3>
          <p>基于 LLM 的智能媒体文件名解析</p>
        </div>
        <div class="feature-card">
          <h3>🔍 自动识别</h3>
          <p>自动识别电影、电视剧和媒体集合</p>
        </div>
        <div class="feature-card">
          <h3>📁 硬链接</h3>
          <p>自动创建硬链接，保持文件系统高效</p>
        </div>
        <div class="feature-card">
          <h3>🔄 实时监控</h3>
          <p>实时文件监控，自动处理新增文件</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-view {
  padding: 0;
}

.welcome-section {
  text-align: center;
  margin-bottom: 40px;
  padding: 40px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: var(--vt-c-white);
  border-radius: 8px;
}

html.dark .welcome-section {
  background: linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%);
}

.welcome-section h1 {
  margin: 0 0 10px 0;
  font-size: 2.5rem;
  font-weight: 600;
}

/* 加载状态 - 骨架屏 */
.loading-section {
  margin-bottom: 40px;
}

.skeleton-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.skeleton-stat-card {
  background: var(--color-background);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 15px;
}

.skeleton-content {
  flex: 1;
}

.skeleton-media-section {
  margin-bottom: 40px;
}

.skeleton-media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

.skeleton-media-card {
  background: var(--color-background);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.skeleton-media-info {
  padding: 15px;
}

/* 错误状态 */
.error-section {
  margin-bottom: 40px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.stat-card {
  background: var(--color-background);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-icon {
  font-size: 2rem;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-background-soft);
  border-radius: 50%;
}

.stat-content h3 {
  margin: 0 0 5px 0;
  color: var(--color-text);
  font-size: 0.9rem;
}

.stat-number {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-heading);
}

.stat-subtitle {
  margin: 5px 0 0 0;
  font-size: 0.8rem;
  color: var(--color-text);
}

/* 最近添加的媒体 */
.recent-media-section {
  margin-bottom: 40px;
}

.recent-media-section h2 {
  margin-bottom: 20px;
  color: var(--color-heading);
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

.media-card {
  background: var(--color-background);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
}

.media-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.media-poster {
  width: 100%;
  height: 120px;
  overflow: hidden;
  background: var(--color-background-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.poster-placeholder {
  font-size: 3rem;
  color: var(--color-border);
}

.media-info {
  padding: 15px;
}

.media-info h3 {
  margin: 0 0 8px 0;
  font-size: 1rem;
  color: var(--color-heading);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.media-type {
  margin: 0 0 5px 0;
  font-size: 0.8rem;
  color: var(--el-color-primary);
  font-weight: 500;
}

.media-files {
  margin: 0 0 5px 0;
  font-size: 0.8rem;
  color: var(--color-text);
}

.media-date {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text);
}

.feature-section h2 {
  margin-bottom: 20px;
  color: var(--color-heading);
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.feature-card {
  background: var(--color-background);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.feature-card h3 {
  margin: 0 0 10px 0;
  color: var(--color-heading);
  font-size: 1.1rem;
}

.feature-card p {
  margin: 0;
  color: var(--color-text);
  line-height: 1.5;
}
</style>
