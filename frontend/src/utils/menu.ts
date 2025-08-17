import type { RouteRecordRaw } from 'vue-router'
import type { MenuItem } from '@/types/menu'

/**
 * 从路由配置生成菜单项
 */
export function generateMenuFromRoutes(routes: readonly RouteRecordRaw[]): MenuItem[] {
  const menuItems: MenuItem[] = []

  routes.forEach(route => {
    // 如果路由有children，则处理其子路由
    if (route.children && route.children.length > 0) {
      route.children.forEach(child => {
        const menuItem = routeToMenuItem(child, route.path)
        if (menuItem) {
          menuItems.push(menuItem)
        }
      })
    } else {
      const menuItem = routeToMenuItem(route)
      if (menuItem) {
        menuItems.push(menuItem)
      }
    }
  })

  return menuItems
}

/**
 * 将单个路由转换为菜单项
 */
function routeToMenuItem(route: RouteRecordRaw, parentPath?: string): MenuItem | null {
  const { meta, path, name, children, redirect } = route
  
  // 只处理需要在菜单中显示的路由
  if (!meta?.showInMenu || !meta?.title) {
    return null
  }

  // 构建完整路径，确保格式一致性
  let fullPath = path
  if (parentPath && parentPath !== '/' && !path.startsWith('/')) {
    fullPath = `${parentPath}/${path}`.replace('//', '/')
  } else if (parentPath && parentPath === '/' && path === '') {
    // 首页特殊处理：父路径是'/'，子路径是''，结果应该是'/'
    fullPath = '/'
  }
  
  // 确保路径以 / 开头（除了空路径）
  if (fullPath && !fullPath.startsWith('/')) {
    fullPath = `/${fullPath}`
  }

  const menuItem: MenuItem = {
    id: name as string || fullPath,
    title: meta.title as string,
    path: redirect ? undefined : fullPath, // 如果有重定向，则不设置path
    icon: meta.icon as string
  }

  // 处理子路由
  if (children && children.length > 0) {
    const childMenuItems: MenuItem[] = []
    
    children.forEach((child: RouteRecordRaw) => {
      const childMenuItem = routeToMenuItem(child, fullPath)
      if (childMenuItem) {
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
    if (!menu.path) continue
    
    // 精确匹配
    if (menu.path === currentPath) {
      return menu.path
    }
    
    // 子路径匹配（处理嵌套路由）
    if (currentPath.startsWith(menu.path + '/')) {
      return menu.path
    }
    
    // 检查子菜单
    if (menu.children) {
      for (const child of menu.children) {
        if (!child.path) continue
        
        // 精确匹配
        if (child.path === currentPath) {
          return child.path
        }
        
        // 子路径匹配
        if (currentPath.startsWith(child.path + '/')) {
          return child.path
        }
      }
    }
  }
  
  return currentPath
}
