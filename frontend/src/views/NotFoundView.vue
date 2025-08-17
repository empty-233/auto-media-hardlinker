<template>
  <div class="not-found-container">
    <div class="not-found-content">
      <div class="error-illustration">
        <div class="error-code">404</div>
        <div class="error-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.6"/>
            <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.8"/>
          </svg>
        </div>
      </div>
      <div class="error-message">页面未找到</div>
      <div class="error-description">
        抱歉，您访问的页面不存在或已被删除。<br>
        请检查URL是否正确，或返回首页继续浏览。
      </div>
      <div class="error-actions">
        <el-button v-if="isAuthenticated" type="primary" size="large" @click="goHome">
          <el-icon><HomeFilled /></el-icon>
          返回首页
        </el-button>
        <el-button v-else type="primary" size="large" @click="goToLogin">
          <el-icon><User /></el-icon>
          去登录
        </el-button>
        <el-button size="large" @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回上页
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { HomeFilled, ArrowLeft, User } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

// 检查用户是否已登录
const isAuthenticated = computed(() => authStore.isAuthenticated)

const goHome = () => {
  router.push('/')
}

const goBack = () => {
  // 检查是否有历史记录可以返回
  if (window.history.length > 1) {
    router.back()
  } else {
    // 如果没有历史记录，则返回首页
    router.push('/')
  }
}

const goToLogin = () => {
  router.push('/auth')
}
</script>

<style scoped>
.not-found-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-background);
  padding: 20px;
  position: relative;
  transition: var(--color-transition);
  overflow: hidden;
}

.not-found-content {
  text-align: center;
  padding: 48px;
  max-width: 600px;
  width: 100%;
}

.error-illustration {
  position: relative;
  margin-bottom: 32px;
}

.error-code {
  font-size: clamp(80px, 15vw, 160px);
  font-weight: 900;
  color: var(--el-color-primary);
  line-height: 1;
  margin-bottom: 16px;
  text-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-3));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.error-icon {
  display: inline-block;
  width: 48px;
  height: 48px;
  color: var(--el-color-primary);
  opacity: 0.6;
}

.error-icon svg {
  width: 100%;
  height: 100%;
}

.error-message {
  font-size: 32px;
  font-weight: 600;
  color: var(--color-heading);
  margin-bottom: 16px;
  transition: var(--color-transition);
}

.error-description {
  color: var(--color-text);
  margin-bottom: 40px;
  font-size: 16px;
  line-height: 1.6;
  opacity: 0.8;
  transition: var(--color-transition);
}

.error-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

/* Element Plus 按钮样式定制 */
:deep(.el-button--primary) {
  background-color: var(--el-color-primary);
  border-color: var(--el-color-primary);
  border-radius: 12px;
  padding: 12px 24px;
  font-weight: 600;
  transition: all 0.3s ease;
}

:deep(.el-button--primary:hover) {
  background-color: var(--el-color-primary-light-3);
  border-color: var(--el-color-primary-light-3);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(var(--el-color-primary-rgb), 0.3);
}

:deep(.el-button--default) {
  background-color: var(--color-background-mute);
  border-color: var(--color-border);
  color: var(--color-text);
  border-radius: 12px;
  padding: 12px 24px;
  font-weight: 600;
  transition: all 0.3s ease;
}

:deep(.el-button--default:hover) {
  background-color: var(--color-background-soft);
  border-color: var(--color-border-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

:deep(.el-button.is-large) {
  height: 48px;
  min-width: 140px;
}

:deep(.el-button .el-icon) {
  margin-right: 8px;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .not-found-content {
    padding: 32px 16px;
  }
  
  .error-message {
    font-size: 24px;
  }
  
  .error-description {
    font-size: 14px;
  }
  
  .error-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .error-actions .el-button {
    width: 100%;
    max-width: 280px;
  }

  .el-button{
    margin-left: 0;
  }
}

/* 动画效果 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.not-found-content {
  animation: fadeInUp 0.6s ease-out;
}

.error-code {
  animation: pulse 2s ease-in-out infinite;
}

/* 深色模式特殊处理 */
html.dark .error-code {
  text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

html.dark :deep(.el-button--default:hover) {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

/* 高对比度模式支持 */
@media (prefers-contrast: high) {
  .error-code {
    -webkit-text-fill-color: var(--el-color-primary);
    background: none;
  }
}

/* 减少动画模式支持 */
@media (prefers-reduced-motion: reduce) {
  .not-found-content {
    animation: none;
  }
  
  .error-code {
    animation: none;
  }
  
  :deep(.el-button:hover) {
    transform: none;
  }
  
  * {
    transition: none !important;
  }
}
</style>
