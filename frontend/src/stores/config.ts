import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useConfigStore = defineStore('config', () => {
  // 状态：标识是否为首次配置（刚注册完毕需要配置）
  // 从 localStorage 读取初始值，如果不存在则为 false
  const isFirstTimeSetup = ref(localStorage.getItem('first_time_setup') === 'true')

  // 设置首次配置状态
  const setFirstTimeSetup = (value: boolean) => {
    isFirstTimeSetup.value = value
    localStorage.setItem('first_time_setup', value.toString())
  }

  // 清除首次配置状态
  const clearFirstTimeSetup = () => {
    isFirstTimeSetup.value = false
    localStorage.removeItem('first_time_setup')
  }

  return {
    // 状态
    isFirstTimeSetup,
    
    // 方法
    setFirstTimeSetup,
    clearFirstTimeSetup
  }
})
