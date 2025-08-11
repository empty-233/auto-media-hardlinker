<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppStore } from '@/stores/app'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

// app store
const appStore = useAppStore()
const { isMobile } = storeToRefs(appStore)

// 动态分页布局
const paginationLayout = computed(() => {
  return isMobile.value ? 'total, prev, pager, next' : 'total, sizes, prev, pager, next, jumper'
})
</script>

<template>
  <div class="pagination-container">
    <el-config-provider :locale="zhCn">
      <el-pagination
        :layout="paginationLayout"
        v-bind="$attrs"
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
