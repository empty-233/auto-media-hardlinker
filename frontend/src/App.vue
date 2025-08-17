<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useColorMode } from '@vueuse/core'
import { useAppStore } from '@/stores/app'

// stores
const appStore = useAppStore()

// 全局主题管理
useColorMode({
  storageKey: 'theme',
  disableTransition: false,
})

// 屏幕尺寸检查
const checkScreenSize = () => {
  appStore.isMobile = window.innerWidth < 768
}

onMounted(() => {
  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkScreenSize)
})
</script>

<template>
  <!-- 所有页面都通过路由系统渲染 -->
  <router-view />
</template>

<style scoped>
/* 全局重置样式 */
* {
  box-sizing: border-box;
}
</style>
