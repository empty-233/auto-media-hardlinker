<script setup lang="ts">
import { computed } from 'vue'
import type { FileInfo } from '@/api/files/types'

interface Props {
  visible: boolean
  fileInfo: FileInfo | null
}

interface Emits {
  (e: 'update:visible', visible: boolean): void
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 计算属性
const visible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
})

// 方法
const handleClose = () => {
  emit('update:visible', false)
  emit('close')
}

// 工具函数
const getFileName = (filePath: string): string => {
  return filePath.split(/[/\\]/).pop() || filePath
}

const formatFileSize = (sizeStr: string): string => {
  const size = parseInt(sizeStr)
  if (isNaN(size)) return sizeStr
  
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
</script>

<template>
  <el-dialog
    v-model="visible"
    title="文件详情"
    width="600px"
    @close="handleClose"
  >
    <div v-if="fileInfo" class="file-detail">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="文件名">
          {{ getFileName(fileInfo.filePath) }}
        </el-descriptions-item>
        <el-descriptions-item label="文件大小">
          {{ formatFileSize(fileInfo.fileSize) }}
        </el-descriptions-item>
        <el-descriptions-item label="文件路径" :span="2">
          <el-input
            :value="fileInfo.filePath"
            readonly
            type="textarea"
            :rows="2"
            class="readonly-input"
          />
        </el-descriptions-item>
        <el-descriptions-item label="硬链接路径" :span="2">
          <el-input
            :value="fileInfo.linkPath || '未创建'"
            readonly
            type="textarea"
            :rows="2"
            class="readonly-input"
          />
        </el-descriptions-item>
        <el-descriptions-item label="文件哈希">
          {{ fileInfo.fileHash }}
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ formatDate(fileInfo.createdAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="关联媒体" :span="2">
          <div v-if="fileInfo.Media" class="media-detail">
            <el-tag type="primary">{{ fileInfo.Media.title }}</el-tag>
            <span v-if="fileInfo.Media.originalTitle" class="original-title">
              ({{ fileInfo.Media.originalTitle }})
            </span>
          </div>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="剧集信息" :span="2">
          <div v-if="fileInfo.episode" class="episode-detail">
            <el-tag type="success">第{{ fileInfo.episode.episodeNumber }}集</el-tag>
            <span v-if="fileInfo.episode.title" class="episode-title">
              - {{ fileInfo.episode.title }}
            </span>
          </div>
          <span v-else>-</span>
        </el-descriptions-item>
      </el-descriptions>
    </div>
    
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleClose">关闭</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<style scoped>
.file-detail {
  padding: 12px 0;
}

.readonly-input :deep(.el-textarea__inner) {
  background-color: #f5f7fa;
  color: #606266;
}

.media-detail {
  display: flex;
  align-items: center;
  gap: 8px;
}

.original-title {
  color: #909399;
  font-size: 14px;
}

.episode-detail {
  display: flex;
  align-items: center;
  gap: 8px;
}

.episode-title {
  color: #606266;
  font-size: 14px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
