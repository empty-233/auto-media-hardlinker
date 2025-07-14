/**
 * 菜单项类型
 */
export interface MenuItem {
  /** 菜单ID */
  id: string
  /** 菜单标题 */
  title: string
  /** 路由路径 */
  path?: string
  /** 图标 */
  icon?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 子菜单 */
  children?: MenuItem[]
  /** 菜单元数据 */
  meta?: {
    /** 是否在菜单中隐藏 */
    hidden?: boolean
    /** 是否始终显示根菜单 */
    alwaysShow?: boolean
    /** 权限角色 */
    roles?: string[]
  }
}
