import type { RouteRecordRaw } from 'vue-router'
import type { MenuItem } from '@/types/menu'

/**
 * 从路由配置生成菜单项
 */
export function generateMenuFromRoutes(routes: readonly RouteRecordRaw[]): MenuItem[] {
  const menuItems: MenuItem[] = []

  routes.forEach(route => {
    const menuItem = routeToMenuItem(route)
    if (menuItem) {
      menuItems.push(menuItem)
    }
  })

  return menuItems
}

/**
 * 将单个路由转换为菜单项
 */
function routeToMenuItem(route: RouteRecordRaw): MenuItem | null {
  const { meta, path, name, children, redirect } = route
  
  // 只处理需要在菜单中显示的路由
  if (!meta?.showInMenu || !meta?.title) {
    return null
  }

  const menuItem: MenuItem = {
    id: name as string || path,
    title: meta.title as string,
    path: redirect ? undefined : path, // 如果有重定向，则不设置path
    icon: meta.icon as string
  }

  // 处理子路由
  if (children && children.length > 0) {
    const childMenuItems: MenuItem[] = []
    
    children.forEach((child: RouteRecordRaw) => {
      const childMenuItem = routeToMenuItem(child)
      if (childMenuItem) {
        // 为子路由补全完整路径
        if (childMenuItem.path && !childMenuItem.path.startsWith('/')) {
          childMenuItem.path = `${path}/${childMenuItem.path}`
        }
        childMenuItems.push(childMenuItem)
      }
    })
    
    if (childMenuItems.length > 0) {
      menuItem.children = childMenuItems
    }
  }

  return menuItem
}

/**
 * 根据当前路由路径查找激活的菜单项
 */
export function findActiveMenu(menus: MenuItem[], currentPath: string, currentRoute?: any): string {
  // 首先检查当前路由是否有 activeMenu 属性
  if (currentRoute?.meta?.activeMenu) {
    return currentRoute.meta.activeMenu
  }
  
  for (const menu of menus) {
    // 检查当前菜单项是否匹配
    if (menu.path === currentPath) {
      return menu.path || menu.id
    }
    
    // 检查子菜单
    if (menu.children) {
      for (const child of menu.children) {
        if (child.path === currentPath) {
          return child.path || child.id
        }
      }
    }
    
    // 检查是否是子路径（用于处理嵌套路由的情况）
    if (menu.path && currentPath.startsWith(menu.path + '/')) {
      return menu.path
    }
  }
  
  return currentPath
}
