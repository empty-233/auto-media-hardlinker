<template>
  <div class="home">
    <el-row :gutter="20">
      <el-col :span="8">
        <el-card class="overview-card">
          <template #header>
            <div class="card-header">
              <h3>媒体概览</h3>
            </div>
          </template>
          <div v-loading="loading">
            <el-statistic title="电视剧" :value="mediaStats.tv" />
            <el-divider />
            <el-statistic title="电影" :value="mediaStats.movie" />
            <el-divider />
            <el-statistic title="合集" :value="mediaStats.collection" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="overview-card">
          <template #header>
            <div class="card-header">
              <h3>文件概览</h3>
            </div>
          </template>
          <div v-loading="loading">
            <el-statistic title="总文件数" :value="fileStats.total" />
            <el-divider />
            <el-statistic title="总存储空间" :value="fileStats.totalSize" :precision="2" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="overview-card">
          <template #header>
            <div class="card-header">
              <h3>系统设置</h3>
            </div>
          </template>
          <div v-loading="configLoading">
            <div class="llm-config-item">
              <span class="label">LLM媒体刮削：</span>
              <span class="value">
                <el-switch
                  v-model="systemConfig.useLlm"
                  :active-text="systemConfig.useLlm ? '已开启' : '已关闭'"
                  :loading="savingConfig"
                  @change="updateLLMConfig"
                />
              </span>
            </div>
            <el-divider />
            <div class="llm-config-item">
              <span class="label">LLM主机：</span>
              <span class="value llm-info">{{ systemConfig.llmHost }}</span>
            </div>
            <el-divider />
            <div class="llm-config-item">
              <span class="label">LLM模型：</span>
              <span class="value llm-info">{{ systemConfig.llmModel }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <h3>最近添加的媒体</h3>
              <el-button type="primary" @click="goToMediaList">查看全部</el-button>
            </div>
          </template>
          <div v-loading="loading">
            <el-table :data="recentMedia" style="width: 100%">
              <el-table-column prop="title" label="标题" />
              <el-table-column prop="type" label="类型">
                <template #default="{ row }">
                  <el-tag :type="getMediaTypeTag(row.type)">{{ getMediaTypeLabel(row.type) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="releaseDate" label="发布日期">
                <template #default="{ row }">
                  {{ row.releaseDate ? new Date(row.releaseDate).toLocaleDateString() : '未知' }}
                </template>
              </el-table-column>
              <el-table-column label="操作">
                <template #default="{ row }">
                  <el-button type="primary" size="small" @click="goToMediaDetail(row.id)">详情</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, type Media, type SystemConfig } from '../api'
import { ElMessage } from 'element-plus'

const router = useRouter()
const loading = ref(true)
const configLoading = ref(true)
const savingConfig = ref(false)
const recentMedia = ref<Media[]>([])
const mediaStats = ref({
  tv: 0,
  movie: 0,
  collection: 0
})
const fileStats = ref({
  total: 0,
  totalSize: '0 GB'
})
const systemConfig = ref<SystemConfig>({
  useLlm: true,
  llmHost: 'http://localhost:11434',
  llmModel: 'qwen2.5'
})

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
    movie: 'info',
    collection: 'warning'
  }
  return tags[type] || ''
}

const goToMediaList = () => {
  router.push('/media')
}

const goToMediaDetail = (id: number) => {
  router.push(`/media/${id}`)
}

const formatSize = (sizeInBytes: number) => {
  if (sizeInBytes < 1024) return `${sizeInBytes} B`
  const sizeInKB = sizeInBytes / 1024
  if (sizeInKB < 1024) return `${sizeInKB.toFixed(2)} KB`
  const sizeInMB = sizeInKB / 1024
  if (sizeInMB < 1024) return `${sizeInMB.toFixed(2)} MB`
  const sizeInGB = sizeInMB / 1024
  return `${sizeInGB.toFixed(2)} GB`
}

// 加载系统配置
const loadSystemConfig = async () => {
  configLoading.value = true
  try {
    const response = await api.getSystemConfig()
    systemConfig.value = response.data
  } catch (error) {
    console.error('加载系统配置失败:', error)
    ElMessage.error('无法加载系统配置')
  } finally {
    configLoading.value = false
  }
}

// 更新LLM配置
const updateLLMConfig = async (value: boolean) => {
  savingConfig.value = true
  try {
    const response = await api.updateSystemConfig({ useLlm: value })
    systemConfig.value = response.data
    ElMessage.success(`LLM媒体刮削已${value ? '开启' : '关闭'}`)
  } catch (error) {
    console.error('更新LLM配置失败:', error)
    ElMessage.error('更新LLM配置失败')
    // 回滚UI状态
    systemConfig.value.useLlm = !value
  } finally {
    savingConfig.value = false
  }
}

onMounted(async () => {
  try {
    // 获取所有媒体数据
    const mediaResponse = await api.getAllMedia()
    const allMedia = mediaResponse.data

    // 获取最近添加的5个媒体
    recentMedia.value = [...allMedia]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)

    // 计算媒体统计信息
    mediaStats.value = {
      tv: allMedia.filter(item => item.type === 'tv').length,
      movie: allMedia.filter(item => item.type === 'movie').length,
      collection: allMedia.filter(item => item.type === 'collection').length
    }

    // 获取所有文件数据
    const filesResponse = await api.getAllFiles()
    const allFiles = filesResponse.data

    // 计算文件统计信息
    const totalSize = allFiles.reduce((sum, file) => sum + BigInt(file.fileSize), BigInt(0))
    fileStats.value = {
      total: allFiles.length,
      totalSize: formatSize(Number(totalSize))
    }
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.value = false
    await loadSystemConfig()
  }
})
</script>

<style scoped>
.home {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.overview-card {
  height: 100%;
}

.el-statistic {
  margin-bottom: 15px;
}

.llm-config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.llm-config-item .label {
  font-weight: 500;
}

.llm-config-item .value {
  color: var(--el-text-color-regular);
  text-align: right;
}

.llm-config-item .llm-info {
  font-family: monospace;
  padding: 2px 6px;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
}
</style>