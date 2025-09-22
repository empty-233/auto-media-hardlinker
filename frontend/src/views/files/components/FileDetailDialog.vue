<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Edit, Check, Close, Link, ArrowLeft } from '@element-plus/icons-vue'
import type { FileSystemItem, LinkMediaParams } from '@/api/files/types'
import { FileService } from '@/api/files'
import { TMDBService, type TMDBSearchItem } from '@/api/tmdb'
import { MediaService } from '@/api/media'

interface Props {
  fileInfo: FileSystemItem | null
}

interface Emits {
  (e: 'close'): void
  (e: 'refresh'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 使用 defineModel 替代 v-model 的手动实现
const visible = defineModel<boolean>('visible', { default: false })

// 响应式数据
const editMode = ref(false)
const editFileName = ref('')
const tmdbSearchQuery = ref('')
const tmdbSearchResults = ref<TMDBSearchItem[]>([])
const tmdbSearchLoading = ref(false)
const selectedTmdbItem = ref<TMDBSearchItem | null>(null)
const saveLoading = ref(false)
const linkMediaLoading = ref(false)

// 多步骤流程状态
const currentStep = ref<'search' | 'seasons' | 'episodes' | 'confirm'>('search')
const selectedSeasonNumber = ref<number | null>(null)
const selectedEpisodeNumber = ref<number | null>(null)
const selectedEpisodeInfo = ref<any | null>(null)
const selectedSeasonInfo = ref<any | null>(null)
const seasonsData = ref<any[]>([])
const episodesData = ref<any[]>([])
const loadingSeasons = ref(false)
const loadingEpisodes = ref(false)

// 面包屑数据
interface BreadcrumbItem {
  label: string
  step: 'search' | 'seasons' | 'episodes' | 'confirm'
  active: boolean
  clickable: boolean
}

const breadcrumbItems = ref<BreadcrumbItem[]>([])

// 更新面包屑
const updateBreadcrumb = () => {
  const items: BreadcrumbItem[] = [
    {
      label: '1. 搜索媒体',
      step: 'search',
      active: currentStep.value === 'search',
      clickable: true,
    },
  ]

  if (selectedTmdbItem.value?.media_type === 'tv') {
    // 只显示当前步骤及之前的步骤
    if (
      currentStep.value === 'seasons' ||
      currentStep.value === 'episodes' ||
      currentStep.value === 'confirm'
    ) {
      items.push({
        label: '2. 选择季数',
        step: 'seasons',
        active: currentStep.value === 'seasons',
        clickable: selectedTmdbItem.value !== null,
      })
    }

    if (currentStep.value === 'episodes' || currentStep.value === 'confirm') {
      items.push({
        label: '3. 选择集数',
        step: 'episodes',
        active: currentStep.value === 'episodes',
        clickable: selectedSeasonNumber.value !== null,
      })
    }

    if (currentStep.value === 'confirm') {
      items.push({
        label: '4. 确认信息',
        step: 'confirm',
        active: currentStep.value === 'confirm',
        clickable: false,
      })
    }
  } else if (selectedTmdbItem.value?.media_type === 'movie') {
    // 电影只有两步，只在确认步骤时显示第二步
    if (currentStep.value === 'confirm') {
      items.push({
        label: '2. 确认信息',
        step: 'confirm',
        active: currentStep.value === 'confirm',
        clickable: false,
      })
    }
  }

  breadcrumbItems.value = items
}

// 方法
const handleClose = () => {
  visible.value = false
  emit('close')
  resetState()
}

// 处理对话框打开事件
const handleOpen = () => {
  if (props.fileInfo && !props.fileInfo.isDirectory) {
    editFileName.value = props.fileInfo.name
    // 如果有关联的媒体，预填搜索框
    if (props.fileInfo.databaseRecord?.Media) {
      tmdbSearchQuery.value = props.fileInfo.databaseRecord.Media.title
    } else {
      // 尝试从文件名提取搜索关键词
      const baseName = props.fileInfo.name.replace(/\.[^/.]+$/, '') // 去掉扩展名
      const cleanName = baseName.replace(/\[.*?\]/g, '').trim() // 去掉方括号内容
      tmdbSearchQuery.value = cleanName
    }
  }
  resetState()
  updateBreadcrumb()
}

const resetState = () => {
  editMode.value = false
  selectedTmdbItem.value = null
  tmdbSearchResults.value = []
  tmdbSearchLoading.value = false
  saveLoading.value = false
  linkMediaLoading.value = false
  currentStep.value = 'search'
  selectedSeasonNumber.value = null
  selectedEpisodeNumber.value = null
  selectedEpisodeInfo.value = null
  selectedSeasonInfo.value = null
  seasonsData.value = []
  episodesData.value = []
  loadingSeasons.value = false
  loadingEpisodes.value = false
  breadcrumbItems.value = []
  updateBreadcrumb()
}

const startEdit = () => {
  editMode.value = true
  nextTick(() => {
    // 聚焦到输入框
    const input = document.querySelector('.edit-filename-input input') as HTMLInputElement
    if (input) {
      input.focus()
      input.select()
    }
  })
}

const cancelEdit = () => {
  editMode.value = false
  if (props.fileInfo) {
    editFileName.value = props.fileInfo.name
  }
}

const saveFileName = async () => {
  if (!props.fileInfo || !editFileName.value.trim()) {
    ElMessage.warning('请输入有效的文件名')
    return
  }

  if (editFileName.value === props.fileInfo.name) {
    editMode.value = false
    return
  }

  try {
    saveLoading.value = true
    await FileService.renameFile(props.fileInfo.fullPath, {
      newName: editFileName.value.trim(),
    })

    ElMessage.success('文件重命名成功')
    editMode.value = false

    // 重命名成功后立即刷新父组件数据
    emit('refresh')

    // 关闭弹窗，让父组件重新获取数据
    handleClose()
  } catch (error) {
    console.error('重命名失败:', error)
    ElMessage.error('重命名失败，请稍后重试')
  } finally {
    saveLoading.value = false
  }
}

const searchTMDB = async () => {
  if (!tmdbSearchQuery.value.trim()) {
    ElMessage.warning('请输入搜索关键词')
    return
  }

  try {
    tmdbSearchLoading.value = true
    const response = await TMDBService.searchMulti({
      query: tmdbSearchQuery.value.trim(),
      language: 'zh-CN',
    })
    tmdbSearchResults.value = response.results

    if (response.results.length === 0) {
      ElMessage.info('未找到相关媒体信息')
    }
  } catch (error) {
    console.error('搜索失败:', error)
    ElMessage.error('搜索失败，请稍后重试')
    tmdbSearchResults.value = []
  } finally {
    tmdbSearchLoading.value = false
  }
}

const selectTmdbItem = async (item: TMDBSearchItem) => {
  selectedTmdbItem.value = item

  if (item.media_type === 'movie') {
    // 电影直接跳转到确认步骤
    currentStep.value = 'confirm'
  } else if (item.media_type === 'tv') {
    // 电视剧需要先选择季数
    currentStep.value = 'seasons'
    await loadSeasons(item.id)
  }
  updateBreadcrumb()
}

// 加载电视剧的季数信息
const loadSeasons = async (tvId: number) => {
  try {
    loadingSeasons.value = true
    const tvInfo = await TMDBService.getTvInfo(tvId, { language: 'zh-CN' })
    seasonsData.value = tvInfo.seasons || []
  } catch (error) {
    console.error('加载季数失败:', error)
    ElMessage.error('加载季数失败，请稍后重试')
    seasonsData.value = []
  } finally {
    loadingSeasons.value = false
  }
}

// 选择季数
const selectSeason = async (seasonNumber: number) => {
  selectedSeasonNumber.value = seasonNumber
  // 找到并存储选中的季数信息
  selectedSeasonInfo.value =
    seasonsData.value.find((season) => season.season_number === seasonNumber) || null
  currentStep.value = 'episodes'
  if (selectedTmdbItem.value) {
    await loadEpisodes(selectedTmdbItem.value.id, seasonNumber)
  }
  updateBreadcrumb()
}

// 加载季的集数信息
const loadEpisodes = async (tvId: number, seasonNumber: number) => {
  try {
    loadingEpisodes.value = true
    const seasonInfo = await TMDBService.getSeasonInfo(tvId, seasonNumber, { language: 'zh-CN' })
    episodesData.value = seasonInfo.episodes || []
  } catch (error) {
    console.error('加载集数失败:', error)
    ElMessage.error('加载集数失败，请稍后重试')
    episodesData.value = []
  } finally {
    loadingEpisodes.value = false
  }
}

// 选择集数
const selectEpisode = (episode: any) => {
  selectedEpisodeNumber.value = episode.episode_number
  selectedEpisodeInfo.value = episode
  currentStep.value = 'confirm'
  updateBreadcrumb()
}

// 返回上一步
const goBack = () => {
  if (currentStep.value === 'seasons') {
    currentStep.value = 'search'
    selectedTmdbItem.value = null
  } else if (currentStep.value === 'episodes') {
    currentStep.value = 'seasons'
    selectedSeasonNumber.value = null
    selectedSeasonInfo.value = null
  } else if (currentStep.value === 'confirm') {
    if (selectedTmdbItem.value?.media_type === 'tv') {
      currentStep.value = 'episodes'
      selectedEpisodeNumber.value = null
      selectedEpisodeInfo.value = null
    } else {
      currentStep.value = 'search'
      selectedTmdbItem.value = null
    }
  }
  updateBreadcrumb()
}

// 面包屑点击处理
const handleBreadcrumbClick = (item: BreadcrumbItem) => {
  if (!item.clickable || item.active) return

  currentStep.value = item.step

  // 根据步骤清理相关状态
  if (item.step === 'search') {
    selectedTmdbItem.value = null
    selectedSeasonNumber.value = null
    selectedEpisodeNumber.value = null
    selectedEpisodeInfo.value = null
    selectedSeasonInfo.value = null
  } else if (item.step === 'seasons') {
    selectedSeasonNumber.value = null
    selectedEpisodeNumber.value = null
    selectedEpisodeInfo.value = null
    selectedSeasonInfo.value = null
  } else if (item.step === 'episodes') {
    selectedEpisodeNumber.value = null
    selectedEpisodeInfo.value = null
  }

  updateBreadcrumb()
}

const saveAndLink = async () => {
  if (!props.fileInfo || !selectedTmdbItem.value) {
    ElMessage.warning('请先选择要关联的媒体')
    return
  }

  // 对于电视剧，必须选择季数和集数
  if (
    selectedTmdbItem.value.media_type === 'tv' &&
    (selectedSeasonNumber.value === null || selectedEpisodeNumber.value === null)
  ) {
    ElMessage.warning('请先选择季数和集数')
    return
  }

  // 显示进度提示
  const loadingMessage = ElMessage({
    message: '正在关联媒体，此过程可能需要1-2分钟...',
    type: 'info',
    duration: 0, // 不自动关闭
    showClose: true,
  })

  try {
    linkMediaLoading.value = true

    // 将TMDBSearchItem转换为IdentifiedMedia格式
    const mediaInfo = {
      type: selectedTmdbItem.value.media_type,
      tmdbId: selectedTmdbItem.value.id,
      title: selectedTmdbItem.value.title || selectedTmdbItem.value.name,
      originalTitle:
        selectedTmdbItem.value.original_title || selectedTmdbItem.value.original_name,
      releaseDate:
        selectedTmdbItem.value.release_date || selectedTmdbItem.value.first_air_date,
      description: selectedTmdbItem.value.overview,
      posterPath: selectedTmdbItem.value.poster_path,
      backdropPath: selectedTmdbItem.value.backdrop_path,
      rawData: selectedTmdbItem.value,
    }

    // 根据文件是否已入库，决定ID和参数
    const fileId = props.fileInfo.databaseRecord?.id ?? 'new'
    const params: LinkMediaParams = {
      mediaInfo: mediaInfo,
      filename: props.fileInfo.name,
      path: props.fileInfo.path,
    }

    if (
      selectedTmdbItem.value.media_type === 'tv' &&
      selectedSeasonNumber.value !== null &&
      selectedEpisodeNumber.value !== null
    ) {
      params.episodeTmdbId = selectedEpisodeInfo.value?.id
      params.seasonNumber = selectedSeasonNumber.value
      params.episodeNumber = selectedEpisodeNumber.value
    }

    await FileService.linkMedia(fileId, params)

    ElMessage.success('关联媒体成功')

    // 触发刷新事件
    emit('refresh')

    // 关闭弹窗
    handleClose()
  } catch (error: unknown) {
    console.error('保存关联失败:', error)

    // 根据错误类型显示不同的错误信息
    let errorMessage = '保存关联失败，请稍后重试'

    if (error instanceof Error) {
      if (error.message?.includes('timeout')) {
        errorMessage =
          '操作超时，请检查网络连接后重试。注意：电视剧关联可能需要较长时间同步剧集信息。'
      } else if (error.message?.includes('Network Error')) {
        errorMessage = '网络连接错误，请检查网络后重试'
      }
    }

    // 处理axios错误响应
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const axiosError = error as { response?: { data?: { message?: string } } }
      if (axiosError.response?.data?.message) {
        errorMessage = axiosError.response.data.message
      }
    }

    ElMessage.error(errorMessage)
  } finally {
    loadingMessage.close()
    linkMediaLoading.value = false
  }
}

// 工具函数
const formatFileSize = (size?: number): string => {
  if (!size) return '-'

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

const getMediaTypeName = (item: TMDBSearchItem): string => {
  if (item.media_type === 'movie') return '电影'
  if (item.media_type === 'tv') return '电视剧'
  return '未知'
}

const getMediaTypeClass = (item: TMDBSearchItem): string => {
  if (item.media_type === 'movie') return 'media-type-movie'
  if (item.media_type === 'tv') return 'media-type-tv'
  return ''
}

const getPosterUrl = (posterPath?: string): string => {
  if (!posterPath) return ''
  return `https://image.tmdb.org/t/p/w200${posterPath}`
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="编辑文件与关联媒体"
    width="90%"
    top="5vh"
    :close-on-click-modal="false"
    @close="handleClose"
    @open="handleOpen"
  >
    <!-- 如果是目录，显示提示 -->
    <div v-if="!fileInfo || fileInfo.isDirectory" class="directory-notice">
      <el-result icon="warning" title="无法编辑" sub-title="该项目是目录，无法进行编辑操作">
        <template #extra>
          <el-button type="primary" @click="handleClose">关闭</el-button>
        </template>
      </el-result>
    </div>

    <!-- 文件编辑界面 -->
    <div v-else class="file-edit-container">
      <!-- 左侧：文件信息 -->
      <div class="file-info-section">
        <h3 class="section-title">文件信息</h3>

        <!-- 文件名编辑 -->
        <div class="info-item">
          <label class="info-label">文件名</label>
          <div class="info-content">
            <div v-if="!editMode" class="file-name-display">
              <div class="file-name-text">{{ fileInfo.name }}</div>
              <el-button link :icon="Edit" size="small" class="edit-btn" @click="startEdit">
                编辑
              </el-button>
            </div>
            <div v-else class="file-name-edit-mode">
              <el-input
                v-model="editFileName"
                @keyup.enter="saveFileName"
                @keyup.esc="cancelEdit"
              />
              <div class="edit-actions">
                <span class="edit-actions-tip"
                  >tip: 修改文件名会触发文件刮削，刮削完成后不会自动刷新</span
                >
                <el-button type="primary" size="small" :loading="saveLoading" @click="saveFileName">
                  保存
                </el-button>
                <el-button size="small" @click="cancelEdit">取消</el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 文件路径 -->
        <div class="info-item">
          <label class="info-label">文件路径</label>
          <div class="info-content">
            <div class="file-path">{{ fileInfo.path }}</div>
          </div>
        </div>

        <!-- 文件大小 -->
        <div class="info-item">
          <label class="info-label">文件大小</label>
          <div class="info-content">
            <div class="file-size">{{ formatFileSize(fileInfo.size) }}</div>
          </div>
        </div>

        <!-- 修改日期 -->
        <div class="info-item">
          <label class="info-label">修改日期</label>
          <div class="info-content">
            <div class="file-date">{{ formatDate(fileInfo.modifiedTime) }}</div>
          </div>
        </div>

        <!-- 数据库状态 -->
        <div class="info-item">
          <label class="info-label">数据库状态</label>
          <div class="info-content">
            <el-tag :type="fileInfo.inDatabase ? 'success' : 'warning'">
              {{ fileInfo.inDatabase ? '已入库' : '未入库' }}
            </el-tag>
          </div>
        </div>

        <!-- 当前关联的媒体信息 -->
        <div v-if="fileInfo.databaseRecord?.Media" class="current-media">
          <h4>当前关联媒体</h4>
          <div class="current-media-info">
            <div class="media-title">{{ fileInfo.databaseRecord.Media.title }}</div>
            <div v-if="fileInfo.databaseRecord.Media.originalTitle" class="media-original-title">
              ({{ fileInfo.databaseRecord.Media.originalTitle }})
            </div>
            <div v-if="fileInfo.databaseRecord.episodeInfo" class="episode-info">
              第{{ fileInfo.databaseRecord.episodeInfo.episodeNumber }}集
              <span v-if="fileInfo.databaseRecord.episodeInfo.title">
                - {{ fileInfo.databaseRecord.episodeInfo.title }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：关联媒体信息 (TMDB) -->
      <div class="media-info-section">
        <!-- 步骤指示器 -->
        <div class="step-header">
          <div class="step-breadcrumb">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item
                v-for="item in breadcrumbItems"
                :key="item.step"
                :class="{
                  active: item.active,
                  clickable: item.clickable && !item.active,
                }"
                @click="handleBreadcrumbClick(item)"
              >
                {{ item.label }}
              </el-breadcrumb-item>
            </el-breadcrumb>
          </div>

          <!-- 返回按钮 -->
          <el-button v-if="currentStep !== 'search'" @click="goBack" size="small" :icon="ArrowLeft">
            返回上一步
          </el-button>
        </div>

        <!-- 步骤1: 搜索媒体 -->
        <div v-if="currentStep === 'search'" class="step-content">
          <h3 class="section-title">搜索媒体</h3>

          <!-- TMDB搜索 -->
          <div class="tmdb-search">
            <el-input
              v-model="tmdbSearchQuery"
              placeholder="请输入电影或电视剧名称进行搜索"
              class="search-input"
              @keyup.enter="searchTMDB"
            >
              <template #append>
                <el-button :icon="Search" :loading="tmdbSearchLoading" @click="searchTMDB">
                  搜索
                </el-button>
              </template>
            </el-input>
          </div>

          <!-- TMDB搜索结果 -->
          <div v-if="tmdbSearchResults.length > 0" class="tmdb-results">
            <div
              v-for="item in tmdbSearchResults"
              :key="item.id"
              class="tmdb-result-item"
              @click="selectTmdbItem(item)"
            >
              <div class="result-poster">
                <img
                  v-if="item.poster_path"
                  :src="getPosterUrl(item.poster_path)"
                  :alt="item.title || item.name"
                  class="poster-image"
                />
                <div v-else class="poster-placeholder">
                  <span class="media-type-icon">{{
                    item.media_type === 'tv' ? 'TV' : '电影'
                  }}</span>
                </div>
              </div>
              <div class="result-info">
                <div class="result-title">
                  {{ item.title || item.name }}
                  <span v-if="item.release_date || item.first_air_date" class="result-date">
                    ({{ (item.release_date || item.first_air_date)?.substring(0, 4) }})
                  </span>
                </div>
                <div v-if="item.original_title || item.original_name" class="result-original-title">
                  {{ item.original_title || item.original_name }}
                </div>
                <div v-if="item.overview" class="result-overview">
                  {{ item.overview }}
                </div>
                <div class="result-meta">
                  <el-tag :class="getMediaTypeClass(item)" size="small" effect="dark" round>
                    {{ getMediaTypeName(item) }}
                  </el-tag>
                </div>
              </div>
              <div class="result-action">
                <el-button type="primary" plain>选择</el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 步骤2: 选择季数 (仅电视剧) -->
        <div v-if="currentStep === 'seasons'" class="step-content">
          <h3 class="section-title">选择季数</h3>

          <!-- 选中的媒体信息 -->
          <div v-if="selectedTmdbItem" class="selected-media-info">
            <div class="media-poster">
              <img
                v-if="selectedTmdbItem.poster_path"
                :src="getPosterUrl(selectedTmdbItem.poster_path)"
                :alt="selectedTmdbItem.title || selectedTmdbItem.name"
                class="poster-image"
              />
              <div v-else class="poster-placeholder">
                <span class="media-type-icon">TV</span>
              </div>
            </div>
            <div class="media-details">
              <h4>{{ selectedTmdbItem.title || selectedTmdbItem.name }}</h4>
              <p v-if="selectedTmdbItem.original_title || selectedTmdbItem.original_name">
                {{ selectedTmdbItem.original_title || selectedTmdbItem.original_name }}
              </p>
              <div class="media-meta">
                <el-tag
                  :class="getMediaTypeClass(selectedTmdbItem)"
                  size="small"
                  effect="dark"
                  round
                >
                  {{ getMediaTypeName(selectedTmdbItem) }}
                </el-tag>
                <span v-if="selectedTmdbItem.release_date || selectedTmdbItem.first_air_date">
                  {{
                    (selectedTmdbItem.release_date || selectedTmdbItem.first_air_date)?.substring(
                      0,
                      4,
                    )
                  }}
                </span>
              </div>
              <div v-if="selectedTmdbItem.overview" class="media-overview">
                {{ selectedTmdbItem.overview }}
              </div>
            </div>
          </div>

          <!-- 季数列表 -->
          <div v-loading="loadingSeasons" class="seasons-list">
            <div
              v-for="season in seasonsData"
              :key="season.season_number"
              class="season-item"
              @click="selectSeason(season.season_number)"
            >
              <div class="season-poster">
                <img
                  v-if="season.poster_path"
                  :src="getPosterUrl(season.poster_path)"
                  :alt="season.name"
                  class="poster-image"
                />
                <div v-else class="poster-placeholder">
                  <span>S{{ season.season_number }}</span>
                </div>
              </div>
              <div class="season-info">
                <div class="season-title">{{ season.name }}</div>
                <div class="season-episodes">{{ season.episode_count }} 集</div>
                <div v-if="season.overview" class="season-overview">{{ season.overview }}</div>
              </div>
              <div class="season-action">
                <el-button type="primary" plain>选择</el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 步骤3: 选择集数 (仅电视剧) -->
        <div v-if="currentStep === 'episodes'" class="step-content">
          <h3 class="section-title">选择集数</h3>

          <!-- 选中的媒体和季数信息 -->
          <div v-if="selectedTmdbItem && selectedSeasonNumber!==null" class="selected-media-info">
            <div class="media-poster">
              <img
                v-if="selectedSeasonInfo?.poster_path"
                :src="getPosterUrl(selectedSeasonInfo.poster_path)"
                :alt="selectedSeasonInfo.name"
                class="poster-image"
              />
              <img
                v-else-if="selectedTmdbItem.poster_path"
                :src="getPosterUrl(selectedTmdbItem.poster_path)"
                :alt="selectedTmdbItem.title || selectedTmdbItem.name"
                class="poster-image"
              />
              <div v-else class="poster-placeholder">
                <span class="media-type-icon">S{{ selectedSeasonNumber }}</span>
              </div>
            </div>
            <div class="media-details">
              <h4>
                {{ selectedTmdbItem.title || selectedTmdbItem.name }} - 第{{
                  selectedSeasonNumber
                }}季
              </h4>
              <p v-if="selectedTmdbItem.original_title || selectedTmdbItem.original_name">
                {{ selectedTmdbItem.original_title || selectedTmdbItem.original_name }}
              </p>
              <div class="media-meta">
                <el-tag
                  :class="getMediaTypeClass(selectedTmdbItem)"
                  size="small"
                  effect="dark"
                  round
                >
                  {{ getMediaTypeName(selectedTmdbItem) }}
                </el-tag>
                <span v-if="selectedTmdbItem.release_date || selectedTmdbItem.first_air_date">
                  {{
                    (selectedTmdbItem.release_date || selectedTmdbItem.first_air_date)?.substring(
                      0,
                      4,
                    )
                  }}
                </span>
              </div>
              <div
                v-if="selectedSeasonInfo?.overview || selectedTmdbItem.overview"
                class="media-overview"
              >
                {{ selectedSeasonInfo?.overview || selectedTmdbItem.overview }}
              </div>
            </div>
          </div>

          <!-- 集数列表 -->
          <div v-loading="loadingEpisodes" class="episodes-list">
            <div
              v-for="episode in episodesData"
              :key="episode.episode_number"
              class="episode-item"
              @click="selectEpisode(episode)"
            >
              <div class="episode-poster">
                <img
                  v-if="episode.still_path"
                  :src="`https://image.tmdb.org/t/p/w300${episode.still_path}`"
                  :alt="episode.name"
                  class="still-image"
                />
                <div v-else class="poster-placeholder">
                  <span>{{ episode.episode_number }}</span>
                </div>
              </div>
              <div class="episode-info">
                <div class="episode-title">
                  第{{ episode.episode_number }}集: {{ episode.name }}
                </div>
                <div v-if="episode.overview" class="episode-overview">
                  {{ episode.overview }}
                </div>
                <div v-if="episode.air_date" class="episode-date">
                  播出日期: {{ episode.air_date }}
                </div>
              </div>
              <div class="episode-action">
                <el-button type="primary" plain>选择</el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 步骤4: 确认信息 -->
        <div v-if="currentStep === 'confirm'" class="step-content">
          <h3 class="section-title">确认关联信息</h3>

          <!-- 操作提示 -->
          <div class="operation-notice">
            <el-alert
              title="操作提示"
              type="info"
              :closable="false"
              show-icon
            >
              <template #default>
                <div class="notice-content">
                  <p>关联媒体将执行以下操作：</p>
                  <ul>
                    <li>从TMDB下载媒体海报和信息</li>
                    <li v-if="selectedTmdbItem?.media_type === 'tv'">同步电视剧的剧集信息</li>
                    <li>创建硬链接到媒体库</li>
                    <li>保存关联信息到数据库</li>
                  </ul>
                  <p class="notice-warning">
                    <strong>注意：</strong>
                    <span v-if="selectedTmdbItem?.media_type === 'tv'">
                      电视剧关联可能需要1-2分钟来同步所有剧集信息，请耐心等待。
                    </span>
                    <span v-else>
                      此操作通常在30秒内完成。
                    </span>
                  </p>
                </div>
              </template>
            </el-alert>
          </div>

          <div v-if="selectedTmdbItem" class="confirm-info">
            <div class="confirm-media">
              <div class="media-poster">
                <img
                  v-if="selectedTmdbItem.poster_path"
                  :src="getPosterUrl(selectedTmdbItem.poster_path)"
                  :alt="selectedTmdbItem.title || selectedTmdbItem.name"
                  class="poster-image"
                />
              </div>
              <div class="media-details">
                <h4>{{ selectedTmdbItem.title || selectedTmdbItem.name }}</h4>
                <p v-if="selectedTmdbItem.original_title || selectedTmdbItem.original_name">
                  {{ selectedTmdbItem.original_title || selectedTmdbItem.original_name }}
                </p>
                <div class="media-meta">
                  <el-tag
                    :class="getMediaTypeClass(selectedTmdbItem)"
                    size="small"
                    effect="dark"
                    round
                  >
                    {{ getMediaTypeName(selectedTmdbItem) }}
                  </el-tag>
                  <span v-if="selectedTmdbItem.release_date || selectedTmdbItem.first_air_date">
                    {{
                      (selectedTmdbItem.release_date || selectedTmdbItem.first_air_date)?.substring(
                        0,
                        4,
                      )
                    }}
                  </span>
                </div>
                <div v-if="selectedTmdbItem.media_type === 'tv'" class="episode-detail">
                  <el-tag type="success"
                    >第{{ selectedSeasonNumber }}季 第{{ selectedEpisodeNumber }}集</el-tag
                  >
                </div>
                <p v-if="selectedTmdbItem.overview" class="media-description">
                  {{ selectedTmdbItem.overview }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">
          {{ fileInfo?.isDirectory ? '关闭' : '取消' }}
        </el-button>
        <el-button
          v-if="!fileInfo?.isDirectory && currentStep === 'confirm'"
          type="primary"
          :loading="linkMediaLoading"
          @click="saveAndLink"
          :disabled="linkMediaLoading"
        >
          <span v-if="linkMediaLoading">
            {{ selectedTmdbItem?.media_type === 'tv' ? '正在同步剧集信息...' : '正在关联媒体...' }}
          </span>
          <span v-else>
            确认并关联
          </span>
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.directory-notice {
  padding: 20px;
  text-align: center;
}

.file-edit-container {
  display: flex;
  gap: 24px;
  min-height: 400px;
}

.file-info-section {
  flex: 1;
  min-width: 300px;
}

.media-info-section {
  flex: 1;
  min-width: 350px;
  border-left: 1px solid var(--color-border);
  padding-left: 24px;
}

.section-title {
  margin: 0 0 20px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-heading);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 8px;
}

.info-item {
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  min-height: 32px;
}

.info-label {
  width: 70px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--color-text);
  line-height: 20px;
}

.info-content {
  flex: 1;
  min-width: 0;
}

.file-name-display {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-height: 32px;
}

.file-name-text {
  flex: 1;
  padding: 6px 8px;
  background-color: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.4;
  word-break: break-all;
  color: var(--color-heading);
  min-height: 20px;
}

.edit-btn {
  margin-top: 4px;
  flex-shrink: 0;
}

.file-name-edit-mode {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
}
.edit-actions-tip {
  font-size: 12px;
  color: var(--color-text);
  margin-right: 12px;
}

.file-path {
  padding: 6px 8px;
  background-color: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--color-text);
  word-break: break-all;
  font-family: 'Courier New', monospace;
}

.file-size {
  font-size: 13px;
  color: var(--color-heading);
  font-weight: 500;
  line-height: 32px;
}

.file-date {
  font-size: 13px;
  color: var(--color-text);
  line-height: 32px;
}

/* TMDB 搜索样式 */
.tmdb-search {
  margin-bottom: 16px;
}

.episode-inputs {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.episode-inputs .el-input-number {
  flex: 1;
}

.search-input {
  width: 100%;
}

.tmdb-results {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background-color: var(--color-background);
}

.tmdb-result-item {
  display: flex;
  align-items: center;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid var(--color-border);
}

.tmdb-result-item:last-child {
  border-bottom: none;
}

.tmdb-result-item:hover {
  background-color: var(--color-background-soft);
}

.tmdb-result-item.selected {
  background-color: var(--el-color-primary-light-9);
}

.result-poster {
  width: 60px;
  height: 90px;
  margin-right: 16px;
  flex-shrink: 0;
  position: relative;
  background-color: var(--color-background-mute);
  border-radius: 4px;
  overflow: hidden;
}

.poster-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--color-text);
  text-align: center;
  font-weight: bold;
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-heading);
  margin-bottom: 6px;
  line-height: 1.4;
}

.result-original-title {
  font-size: 13px;
  color: var(--color-text);
  margin-bottom: 8px;
  line-height: 1.4;
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text);
}

.result-date {
  color: var(--color-text);
  font-size: 14px;
}

.media-type-movie {
  background-color: #673ab7;
  border-color: #673ab7;
  color: white;
}

.media-type-tv {
  background-color: #f194c8;
  border-color: #f194c8;
  color: white;
}

.result-action {
  display: flex;
  align-items: center;
  margin-left: auto;
  padding-left: 16px;
}

/* 当前关联媒体样式 */
.current-media {
  margin-top: 24px;
  padding: 16px;
  background-color: var(--color-background-soft);
  border-radius: 6px;
}

.current-media h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-heading);
}

.media-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-color-primary);
  margin-bottom: 4px;
}

.media-original-title {
  font-size: 12px;
  color: var(--color-text);
  margin-bottom: 8px;
}

.episode-info {
  font-size: 12px;
  color: var(--el-color-success);
  font-weight: 500;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .file-edit-container {
    flex-direction: column;
    gap: 16px;
  }

  .media-info-section {
    border-left: none;
    border-top: 1px solid var(--color-border);
    padding-left: 0;
    padding-top: 16px;
  }

  .info-item {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }

  .info-label {
    width: auto;
    margin-top: 0;
    margin-bottom: 4px;
    font-weight: 500;
  }

  .file-name-display {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }

  .edit-btn {
    align-self: flex-start;
    margin-top: 0;
  }

  .edit-actions {
    flex-direction: row;
    justify-content: flex-end;
  }
}

/* 步骤指示器样式 */
.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
}

.step-breadcrumb .el-breadcrumb-item {
  cursor: default;
}

.step-breadcrumb .el-breadcrumb-item.clickable {
  cursor: pointer;
}

.step-breadcrumb .el-breadcrumb-item.active {
  color: var(--el-color-primary);
  font-weight: 600;
}

.step-breadcrumb .el-breadcrumb-item.clickable:hover {
  color: var(--el-color-primary);
}

.step-content {
  height: 600px;
  display: flex;
  flex-direction: column;
}

/* 选中的媒体信息样式 */
.selected-media-info,
.confirm-media {
  display: flex;
  gap: 16px;
  padding: 16px;
  background-color: var(--color-background-soft);
  border-radius: 8px;
  margin-bottom: 24px;
}

.media-poster {
  width: 80px;
  height: 120px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  background-color: var(--color-background-mute);
}

.media-poster .poster-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-details h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-heading);
}

.media-details p {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: var(--color-text);
}

.media-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.episode-detail {
  margin-bottom: 12px;
}

.media-description {
  font-size: 13px;
  color: var(--color-text);
  line-height: 1.5;
}

.media-overview {
  font-size: 13px;
  color: var(--color-text);
  line-height: 1.4;
  margin-top: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 季数列表样式 */
.seasons-list {
  flex: 1;
  overflow-y: auto;
  /* display: grid;
  gap: 12px;
  padding-right: 4px; */
}

.season-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.season-item:hover {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

.season-poster {
  width: 60px;
  height: 90px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--color-background-mute);
}

.season-poster .poster-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.season-poster .poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  color: var(--color-text);
}

.season-info {
  flex: 1;
}

.season-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-heading);
  margin-bottom: 4px;
}

.season-episodes {
  font-size: 13px;
  color: var(--color-text);
  margin-bottom: 8px;
}

.season-overview {
  font-size: 12px;
  color: var(--color-text);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.season-action {
  flex-shrink: 0;
}

/* 集数列表样式 */
.episodes-list {
  flex: 1;
  overflow-y: auto;
  display: grid;
  gap: 12px;
  padding-right: 4px;
}

.episode-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.episode-item:hover {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

.episode-poster {
  width: 120px;
  height: 68px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--color-background-mute);
}

.episode-poster .still-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.episode-poster .poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  color: var(--color-text);
}

.episode-info {
  flex: 1;
}

.episode-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-heading);
  margin-bottom: 8px;
}

.episode-overview {
  font-size: 12px;
  color: var(--color-text);
  line-height: 1.4;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.episode-date {
  font-size: 12px;
  color: var(--color-text);
}

.episode-action {
  flex-shrink: 0;
}

/* 确认信息样式 */
.confirm-info {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.operation-notice {
  margin-bottom: 24px;
}

.notice-content {
  font-size: 14px;
  line-height: 1.5;
}

.notice-content ul {
  margin: 8px 0;
  padding-left: 20px;
}

.notice-content li {
  margin-bottom: 4px;
}

.notice-warning {
  margin-top: 12px;
  color: var(--el-color-warning);
  font-size: 13px;
}

.selected-info h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-heading);
  text-align: center;
  padding: 12px;
  background-color: var(--el-color-primary-light-9);
  border-radius: 6px;
}

/* 搜索结果增强 */
.result-overview {
  font-size: 12px;
  color: var(--color-text);
  line-height: 1.4;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
