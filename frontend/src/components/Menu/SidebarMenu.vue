<template>
  <el-menu
    :default-active="activeMenu"
    :collapse="collapse"
    :unique-opened="uniqueOpened"
    :router="router"
    :mode="mode"
    class="sidebar-menu"
    :class="{ 'mobile-menu': isMobile && isDrawer }"
    background-color="white"
    text-color="#606266"
    active-text-color="#409eff"
    @select="handleMenuItemClick"
    v-bind="$attrs"
  >
    <MenuItem v-for="menu in menuList" :key="menu.id" :menu="menu" />
  </el-menu>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMenu } from 'element-plus'
import MenuItem from './MenuItem.vue'
import { generateMenuFromRoutes, findActiveMenu } from '@/utils/menu'
import type { MenuItem as MenuItemType } from '@/types/menu'

interface Props {
  /** 是否折叠菜单 */
  collapse?: boolean
  /** 是否只保持一个子菜单的展开 */
  uniqueOpened?: boolean
  /** 是否启用路由模式 */
  router?: boolean
  /** 菜单模式 */
  mode?: 'horizontal' | 'vertical'
  /** 是否为移动端抽屉模式 */
  isDrawer?: boolean
}

interface Emits {
  (e: 'close-drawer'): void
}

const props = withDefaults(defineProps<Props>(), {
  collapse: false,
  uniqueOpened: true,
  router: true,
  mode: 'vertical',
  isDrawer: false,
})

const emit = defineEmits<Emits>()

const route = useRoute()
const vueRouter = useRouter()
const menuList = ref<MenuItemType[]>([])

// 响应式判断是否为移动端
const isMobile = ref(false)

// 检查屏幕尺寸
const checkScreenSize = () => {
  isMobile.value = window.innerWidth < 768
}

// 当前激活的菜单
const activeMenu = computed(() => {
  return findActiveMenu(menuList.value, route.path, route)
})

// 菜单项点击处理
const handleMenuItemClick = () => {
  if (props.isDrawer && isMobile.value) {
    emit('close-drawer')
  }
}

onMounted(() => {
  // 从路由配置生成菜单，使用原始路由配置避免重复
  menuList.value = generateMenuFromRoutes(vueRouter.options.routes)

  // 初始化屏幕尺寸检查
  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkScreenSize)
})
</script>

<style scoped>
.sidebar-menu {
  border-right: none;
  height: calc(100vh - 60px); /* 减去logo区域的高度 */
  overflow-y: auto;
}

.sidebar-menu:not(.el-menu--collapse) {
  width: 200px;
}

/* 菜单项圆角样式 */
.sidebar-menu :deep(.el-menu-item) {
  border-radius: 8px;
  margin: 4px 8px;
  padding: 0 16px;
  transition: all 0.3s ease;
}

.sidebar-menu :deep(.el-sub-menu .el-sub-menu__title) {
  border-radius: 8px;
  margin: 4px 8px;
  transition: all 0.3s ease;
}

.sidebar-menu :deep(.el-menu-item:hover) {
  background-color: #dadada;
}

.sidebar-menu :deep(.el-sub-menu .el-sub-menu__title:hover) {
  background-color: #dadada;
}

/* 移动端菜单样式 */
.mobile-menu {
  width: 100% !important;
  height: calc(100vh - 60px);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .sidebar-menu {
    width: 100% !important;
  }

  .sidebar-menu:not(.el-menu--collapse) {
    width: 100% !important;
  }

  .sidebar-menu :deep(.el-sub-menu .el-sub-menu__title:hover) {
    background-color: unset !important;
  }
}
</style>
