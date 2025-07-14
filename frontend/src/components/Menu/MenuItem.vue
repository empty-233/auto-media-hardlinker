<template>
  <!-- 如果菜单项有子菜单 -->
  <el-sub-menu
    v-if="hasChildren && !menu.meta?.hidden"
    :index="menu.id"
    :disabled="menu.disabled"
  >
    <template #title>
      <el-icon v-if="menu.icon">
        <component :is="menu.icon" />
      </el-icon>
      <span>{{ menu.title }}</span>
    </template>
    
    <!-- 递归渲染子菜单 -->
    <MenuItem
      v-for="child in menu.children"
      :key="child.id"
      :menu="child"
    />
  </el-sub-menu>

  <!-- 如果菜单项没有子菜单 -->
  <el-menu-item
    v-else-if="!menu.meta?.hidden"
    :index="menu.path || menu.id"
    :disabled="menu.disabled"
  >
    <el-icon v-if="menu.icon">
      <component :is="menu.icon" />
    </el-icon>
    <template #title>
      <span>{{ menu.title }}</span>
    </template>
  </el-menu-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElSubMenu, ElMenuItem, ElIcon } from 'element-plus'
import type { MenuItem as MenuItemType } from '@/types/menu'

interface Props {
  menu: MenuItemType
}

const props = defineProps<Props>()

// 递归组件需要定义名称
defineOptions({
  name: 'MenuItem'
})

// 判断是否有子菜单
const hasChildren = computed(() => {
  return props.menu.children && props.menu.children.length > 0
})
</script>

<style scoped>
/* 移动端优化 */
@media (max-width: 768px) {
  :deep(.el-menu-item .el-icon),
  :deep(.el-sub-menu__title .el-icon) {
    font-size: 18px !important;
  }
}
</style>
