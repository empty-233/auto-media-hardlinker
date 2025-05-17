<template>
  <div class="overlay" v-if="isMobile && !isCollapse" @click="toggleSidebar"></div>
  <el-container class="app-container" :class="{'mobile-open': isMobile && !isCollapse}">
    <el-aside :width="isCollapse ? '64px' : '200px'" class="sidebar" :class="{'collapsed': isCollapse, 'mobile': isMobile}">
      <div class="collapse-btn" @click="toggleSidebar">
        <el-icon :size="20">
          <el-icon-fold v-if="!isCollapse" />
          <el-icon-expand v-else />
        </el-icon>
      </div>
      <el-menu
        router
        default-active="/"
        class="el-menu-vertical"
        :collapse="isCollapse"
        background-color="#545c64"
        text-color="#fff"
        active-text-color="#ffd04b"
        @select="handleMenuSelect"
      >
        <el-menu-item index="/">
          <el-icon><el-icon-house /></el-icon>
          <template #title>首页</template>
        </el-menu-item>
        <el-menu-item index="/media">
          <el-icon><el-icon-film /></el-icon>
          <template #title>媒体库</template>
        </el-menu-item>
        <el-menu-item index="/files">
          <el-icon><el-icon-document /></el-icon>
          <template #title>文件管理</template>
        </el-menu-item>
        <el-menu-item index="/logs">
          <el-icon><el-icon-list /></el-icon>
          <template #title>系统日志</template>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container :class="{'content-container': true, 'mobile-shifted': isMobile && !isCollapse}">
      <el-header class="header">
        <div class="mobile-toggle" @click="toggleSidebar">
          <el-icon :size="24"><el-icon-menu /></el-icon>
        </div>
        <h2>媒体文件管理系统</h2>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
      <el-footer>
        <p>&copy; 2025 媒体文件管理系统</p>
      </el-footer>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  House as ElIconHouse,
  Film as ElIconFilm,
  Document as ElIconDocument,
  List as ElIconList,
  Fold as ElIconFold,
  Expand as ElIconExpand,
  Menu as ElIconMenu
} from '@element-plus/icons-vue'

const isCollapse = ref(false)
const isMobile = ref(false)

const toggleSidebar = () => {
  isCollapse.value = !isCollapse.value
}

// 响应式检测屏幕宽度
const checkScreenWidth = () => {
  isMobile.value = window.innerWidth <= 768
  isCollapse.value = isMobile.value
}

// 在移动设备上选择菜单项后自动收起侧边栏
const handleMenuSelect = () => {
  if (isMobile.value) {
    isCollapse.value = true
  }
}

onMounted(() => {
  checkScreenWidth()
  window.addEventListener('resize', checkScreenWidth)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkScreenWidth)
})
</script>

<style scoped>
.app-container {
  height: 100vh;
  width: 100%;
  position: relative;
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

.content-container {
  transition: margin-left 0.3s;
  position: relative;
  flex-grow: 1;
}

.sidebar {
  transition: width 0.3s, transform 0.3s;
  position: relative;
  background-color: #545c64;
  color: white;
  overflow: hidden;
  flex-shrink: 0;
  z-index: 1001;
}

.collapse-btn {
  height: 56px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 0 20px;
  color: #ffffff;
  cursor: pointer;
}

.header {
  display: flex;
  align-items: center;
  background-color: #f0f2f5;
  color: #333;
  padding: 0 20px;
  width: 100%;
}

.mobile-toggle {
  display: none;
  cursor: pointer;
  margin-right: 10px;
}

.el-header {
  background-color: #f0f2f5;
  color: #333;
  text-align: center;
  width: 100%;
  flex-shrink: 0;
}

.el-main {
  flex: 1;
  width: 100%;
  overflow-x: hidden;
}

.el-footer {
  background-color: #f0f2f5;
  color: #666;
  text-align: center;
  padding: 20px 0;
  width: 100%;
  flex-shrink: 0;
}

.el-menu-vertical {
  height: calc(100% - 56px);
  border-right: none;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .mobile-toggle {
    display: block;
  }
  
  .sidebar {
    position: fixed;
    height: 100%;
    left: 0;
    top: 0;
    transform: translateX(-100%);
  }
  
  .sidebar.mobile:not(.collapsed) {
    transform: translateX(0);
    width: 200px !important;
  }
  
  .sidebar.mobile.collapsed {
    transform: translateX(-100%);
  }
  
  .content-container {
    margin-left: 0 !important;
  }
  
  .collapse-btn {
    display: none;
  }
}
</style>
