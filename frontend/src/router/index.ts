import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: {
        title: '首页',
        icon: 'HomeFilled',
        showInMenu: true
      }
    },
    // 媒体管理
    {
      path: '/media',
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
      path: '/media/detail/:id',
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
      path: '/files',
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
    // 日志管理路由
    {
      path: '/logs',
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
      path: '/config',
      name: 'config',
      component: () => import('../views/config/ConfigView.vue'),
      meta: {
        title: '系统设置',
        icon: 'Setting',
        showInMenu: true
      }
    },
  ],
})

export default router
