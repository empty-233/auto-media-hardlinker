/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_TIMEOUT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** 页面标题 */
    title?: string
    /** 菜单图标 */
    icon?: string
    /** 是否在菜单中显示 */
    showInMenu?: boolean
    /** 是否启用页面缓存 */
    keepAlive?: boolean
    /** 组件名（用于keep-alive缓存） */
    componentName?: string
    /** 激活的菜单项路径 */
    activeMenu?: string
    /** 是否在菜单中隐藏 */
    hidden?: boolean
    /** 是否始终显示根菜单 */
    alwaysShow?: boolean
    /** 权限角色 */
    roles?: string[]
  }
}
