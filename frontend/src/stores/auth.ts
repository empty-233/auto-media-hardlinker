import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { AuthService } from '@/api'
import type { UserInfo } from '@/api'

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const user = ref<UserInfo | null>(null)
  const token = ref<string | null>(localStorage.getItem('auth_token'))
  const loading = ref(false)
  const initialized = ref<boolean | null>(null)

  // 计算属性
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isInitialized = computed(() => initialized.value === true)

  // 检查系统初始化状态
  const checkInitialization = async () => {
    try {
      loading.value = true
      const data = await AuthService.checkInitialization()
      initialized.value = !data.needsInitialization
      return data
    } catch (error) {
      console.error('检查初始化状态失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 注册用户
  const register = async (username: string, password: string) => {
    try {
      loading.value = true
      const response = await AuthService.register({ username, password })
      
      // 保存token和用户信息
      token.value = response.token
      user.value = response.user
      initialized.value = true
      localStorage.setItem('auth_token', response.token)
      
      // 设置axios默认header
      AuthService.setAuthToken(response.token)
      
      return response
    } catch (error) {
      console.error('注册失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 登录
  const login = async (username: string, password: string) => {
    try {
      loading.value = true
      const response = await AuthService.login({ username, password })
      
      // 保存token和用户信息
      token.value = response.token
      user.value = response.user
      localStorage.setItem('auth_token', response.token)
      
      // 设置axios默认header
      AuthService.setAuthToken(response.token)
      
      return response
    } catch (error) {
      console.error('登录失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 获取当前用户信息
  const fetchCurrentUser = async () => {
    try {
      loading.value = true
      const userData = await AuthService.getCurrentUser()
      user.value = userData
      return userData
    } catch (error) {
      console.error('获取用户信息失败:', error)
      // 如果获取用户信息失败，清除认证状态
      logout()
      throw error
    } finally {
      loading.value = false
    }
  }

  // 退出登录
  const logout = () => {
    user.value = null
    token.value = null
    localStorage.removeItem('auth_token')
    AuthService.clearAuthToken()
  }

  // 更新token（用于自动刷新）
  const updateToken = (newToken: string) => {
    token.value = newToken
    localStorage.setItem('auth_token', newToken)
    AuthService.setAuthToken(newToken)
  }

  // 初始化认证状态
  const initializeAuth = async () => {
    if (token.value) {
      AuthService.setAuthToken(token.value)
      try {
        await fetchCurrentUser()
      } catch {
        // 如果token无效，清除认证状态
        logout()
      }
    }
    
    // 检查系统初始化状态
    await checkInitialization()
  }

  return {
    // 状态
    user,
    token,
    loading,
    initialized,
    
    // 计算属性
    isAuthenticated,
    isInitialized,
    
    // 方法
    checkInitialization,
    register,
    login,
    logout,
    updateToken,
    fetchCurrentUser,
    initializeAuth
  }
})
