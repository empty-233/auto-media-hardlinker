import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/layouts/AppLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // 认证路由 - 独立布局
    {
      path: '/auth',
      name: 'auth',
      component: () => import('../views/AuthView.vue'),
      meta: {
        title: '登录',
        requiresGuest: true, // 仅未登录用户可访问
        requiresAuth: false // 明确不需要认证
      }
    },
    
    // 404 页面 - 全屏布局
    {
      path: '/404',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
      meta: {
        title: '页面未找到',
        requiresAuth: false // 明确不需要认证
      }
    },
    
    // 主应用路由 - 使用AppLayout布局
    {
      path: '/',
      component: AppLayout,
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('../views/HomeView.vue'),
          meta: {
            title: '首页',
            icon: 'HomeFilled',
            showInMenu: true
          }
        },
        // 媒体管理
        {
          path: 'media',
          name: 'media',
          component: () => import('../views/media/MediaListView.vue'),
          meta: {
            title: '媒体管理',
            icon: 'VideoPlay',
            showInMenu: true,
            keepAlive: true, // 启用缓存
            componentName: 'MediaListView' // 组件名
          }
        },
        // 媒体详情页面
        {
          path: 'media/detail/:id',
          name: 'media-detail',
          component: () => import('../views/media/MediaDetailView.vue'),
          meta: {
            title: '媒体详情',
            showInMenu: false,
            activeMenu: '/media' // 指定激活的菜单项
          }
        },
        // 文件管理路由
        {
          path: 'files',
          name: 'files',
          component: () => import('../views/files/FileListView.vue'),
          meta: {
            title: '文件管理',
            icon: 'Folder',
            showInMenu: true,
            keepAlive: true, // 启用缓存
            componentName: 'FileListView' // 组件名
          }
        },
        // 队列管理路由
        {
          path: 'queue',
          name: 'queue',
          component: () => import('../views/queue/QueueManagement.vue'),
          meta: {
            title: '队列管理',
            icon: 'List',
            showInMenu: true,
            keepAlive: true,
            componentName: 'QueueManagement'
          }
        },
        // 日志管理路由
        {
          path: 'logs',
          name: 'logs',
          component: () => import('../views/logs/LogListView.vue'),
          meta: {
            title: '系统日志',
            icon: 'Document',
            showInMenu: true
          }
        },
        // 系统配置路由
        {
          path: 'config',
          name: 'config',
          component: () => import('../views/config/ConfigView.vue'),
          meta: {
            title: '系统设置',
            icon: 'Setting',
            showInMenu: true
          }
        }
      ]
    },
    
    // 捕获所有未匹配的路由，重定向到404页面
    {
      path: '/:pathMatch(.*)*',
      redirect: '/404'
    }
  ],
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  // 统一在路由守卫中初始化认证状态
  if (authStore.initialized === null) {
    await authStore.initializeAuth()
  }
  
  // 如果访问登录页面
  if (to.meta.requiresGuest) {
    if (authStore.isAuthenticated) {
      // 已登录用户访问登录页面，重定向到首页
      return next('/')
    }
    return next()
  }
  
  // 检查路由是否需要认证 (默认需要认证，除非明确设置 requiresAuth: false)
  const needsAuth = to.meta.requiresAuth !== false
  
  if (needsAuth) {
    if (!authStore.isInitialized) {
      // 系统未初始化，重定向到认证页面
      return next('/auth')
    }
    
    if (!authStore.isAuthenticated) {
      // 未登录，重定向到认证页面
      return next('/auth')
    }
  }
  
  next()
})

export default router
