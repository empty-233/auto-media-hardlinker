import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    icon?: string
    showInMenu?: boolean
    keepAlive?: boolean
    componentName?: string
    activeMenu?: string
    requiresAuth?: boolean
    requiresGuest?: boolean
  }
}