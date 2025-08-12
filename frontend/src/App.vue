<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { Fold, Expand, Menu, Sunny, Moon, Monitor } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { useColorMode } from '@vueuse/core'
import { SidebarMenu } from '@/components/Menu'
import { useAppStore } from '@/stores/app'

// app store
const appStore = useAppStore()
const { isMobile } = storeToRefs(appStore)

// 深色模式
const { store: theme } = useColorMode({
  storageKey: 'theme',
  disableTransition: false,
})

// 菜单折叠状态
const isCollapse = ref(false)
// 移动端抽屉状态
const drawerVisible = ref(false)

// 获取路由实例
const router = useRouter()

// 动态生成需要缓存的组件名列表
const cachedComponents = computed(() => {
  const components: string[] = []

  // 递归遍历路由配置
  const collectCachedComponents = (routes: any[]) => {
    routes.forEach((route) => {
      // 如果路由配置了 keepAlive: true 且有组件名，则添加到缓存列表
      if (route.meta?.keepAlive === true && route.meta?.componentName) {
        if (!components.includes(route.meta.componentName)) {
          components.push(route.meta.componentName)
        }
      }

      // 递归处理子路由
      if (route.children && route.children.length > 0) {
        collectCachedComponents(route.children)
      }
    })
  }

  collectCachedComponents(router.getRoutes())
  console.log('Cached components:', components) // 调试用，可以在开发时查看缓存的组件
  return components
})

// 检查屏幕尺寸
const checkScreenSize = () => {
  appStore.isMobile = window.innerWidth < 768
  // 在移动端时关闭侧边栏，在桌面端时关闭抽屉
  if (isMobile.value) {
    isCollapse.value = false
  } else {
    drawerVisible.value = false
  }
}

// 切换菜单折叠状态（桌面端）
const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value
}

// 切换移动端抽屉
const toggleDrawer = () => {
  drawerVisible.value = !drawerVisible.value
}

// 关闭抽屉
const closeDrawer = () => {
  drawerVisible.value = false
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
  <el-container class="app-container">
    <!-- 桌面端侧边栏 -->
    <el-aside v-if="!isMobile" width="auto" class="app-aside">
      <div class="logo-container">
        <h2 v-if="!isCollapse" class="logo-title">A M H</h2>
        <span v-else class="logo-icon">M</span>
      </div>
      <SidebarMenu :collapse="isCollapse" />
    </el-aside>

    <!-- 移动端抽屉菜单 -->
    <div class="mobile-drawer" v-if="isMobile">
      <el-drawer v-model="drawerVisible" direction="ltr" size="50%" :with-header="false">
        <div class="logo-container">
          <h2 class="logo-title">A M H</h2>
        </div>
        <SidebarMenu :collapse="false" :is-drawer="true" @close-drawer="closeDrawer" />
      </el-drawer>
    </div>

    <!-- 主内容区域 -->
    <el-container class="main-container">
      <!-- 顶部导航栏 -->
      <el-header class="app-header">
        <div class="header-content">
          <!-- 桌面端折叠按钮 -->
          <el-button
            v-if="!isMobile"
            :icon="isCollapse ? Expand : Fold"
            @click="toggleCollapse"
            text
            class="collapse-btn"
          />
          <!-- 移动端菜单按钮 -->
          <el-button v-else :icon="Menu" @click="toggleDrawer" text class="mobile-menu-btn" />
          <div class="header-title">Auto Media Hardlinker</div>
          <div class="header-actions">
            <!-- 桌面端显示 RadioGroup -->
            <el-radio-group v-if="!isMobile" v-model="theme">
              <el-radio-button value="light">
                <el-icon><Sunny /></el-icon>
              </el-radio-button>
              <el-radio-button value="dark">
                <el-icon><Moon /></el-icon>
              </el-radio-button>
              <el-radio-button value="auto">
                <el-icon><Monitor /></el-icon>
              </el-radio-button>
            </el-radio-group>
            <!-- 移动端显示 Dropdown -->
            <el-dropdown v-else trigger="click">
              <el-button text>
                <el-icon>
                  <Sunny v-if="theme === 'light'" />
                  <Moon v-else-if="theme === 'dark'" />
                  <Monitor v-else />
                </el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="theme = 'light'">
                    <el-icon><Sunny /></el-icon>
                    亮色
                  </el-dropdown-item>
                  <el-dropdown-item @click="theme = 'dark'">
                    <el-icon><Moon /></el-icon>
                    暗色
                  </el-dropdown-item>
                  <el-dropdown-item @click="theme = 'auto'">
                    <el-icon><Monitor /></el-icon>
                    自动
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </el-header>

      <!-- 主内容 -->
      <el-main class="app-main">
        <router-view v-slot="{ Component, route }">
          <keep-alive :include="cachedComponents">
            <component :is="Component" :key="route.path" />
          </keep-alive>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.app-container {
  height: 100vh;
  width: 100vw;
}

.app-aside {
  overflow: hidden;
  height: 100vh;
  position: relative;
}

.logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60px;
  color: var(--el-color-primary);
  /* border-bottom: 1px solid #434a58; */
  background-color: var(--color-background);
  transition: var(--color-transition);
}

.logo-title {
  margin: 0;
  font-size: 20px;
  white-space: nowrap;
  font-weight: 500;
}

.logo-icon {
  font-size: 24px;
  font-weight: bold;
}

.main-container {
  flex: 1;
  height: 100vh;
  overflow: hidden;
}

.app-header {
  background-color: var(--color-background);
  transition: var(--color-transition);
  /* border-bottom: 1px solid #e4e7ed; */
  padding: 0;
  display: flex;
  align-items: center;
  height: 60px;
}

.header-content {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0 20px;
}

.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
}

.collapse-btn,
.mobile-menu-btn {
  margin-right: 20px;
  font-size: 18px;
  color: var(--color-text);
}

.collapse-btn:hover,
.mobile-menu-btn:hover {
  color: var(--el-color-primary);
}

.header-title {
  font-size: 18px;
  font-weight: 500;
  color: var(--color-heading);
}

.app-main {
  background-color: var(--color-background-soft);
  transition: var(--color-transition);
  padding: 20px;
  height: calc(100vh - 60px);
  overflow-y: auto;
}

/* 移动端抽屉样式 */
.mobile-drawer {
  &:deep(.el-drawer__body) {
    padding: 0;
  }
}

.drawer-content {
  height: 100%;
  background-color: var(--color-background);
  transition: var(--color-transition);
  display: flex;
  flex-direction: column;
}

.drawer-content .logo-container {
  flex-shrink: 0;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .app-container {
    height: 100vh;
    width: 100vw;
  }

  .main-container {
    width: 100%;
  }

  .app-main {
    padding: 10px;
  }

  .header-content {
    padding: 0 15px;
  }

  .header-title {
    font-size: 16px;
  }
}

/* 全局重置样式 */
* {
  box-sizing: border-box;
}
</style>
