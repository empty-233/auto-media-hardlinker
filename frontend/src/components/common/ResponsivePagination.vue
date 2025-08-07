<script setup lang="ts">
import { computed } from 'vue'
import { useBreakpoints } from '@vueuse/core'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

// 定义组件的 props
const props = defineProps({
  total: {
    type: Number,
    required: true,
  },
  currentPage: {
    type: Number,
    required: true,
  },
  pageSize: {
    type: Number,
    required: true,
  },
  pageSizes: {
    type: Array,
    default: () => [10, 50, 100],
  },
})

// 定义组件的 emits
const emit = defineEmits(['update:currentPage', 'update:pageSize', 'change'])

// 响应式断点
const breakpoints = useBreakpoints({
  mobile: 768,
})
const isMobile = breakpoints.smaller('mobile')

// 动态分页布局
const paginationLayout = computed(() => {
  return isMobile.value ? 'total, prev, pager, next' : 'total, sizes, prev, pager, next, jumper'
})

// 当前页更新
const onCurrentChange = (page: number) => {
  emit('update:currentPage', page)
  emit('change')
}

// 每页数量更新
const onSizeChange = (size: number) => {
  emit('update:pageSize', size)
  emit('change')
}
</script>

<template>
  <div v-if="total > 0" class="pagination-container">
    <el-config-provider :locale="zhCn">
      <el-pagination
        :current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        :page-sizes="pageSizes"
        :layout="paginationLayout"
        @current-change="onCurrentChange"
        @size-change="onSizeChange"
      />
    </el-config-provider>
  </div>
</template>

<style scoped>
.pagination-container {
  display: flex;
  justify-content: center;
  padding: 24px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

@media (max-width: 768px) {
  .pagination-container {
    flex-wrap: wrap;
    justify-content: center;
    padding: 16px;
  }
}
</style>
