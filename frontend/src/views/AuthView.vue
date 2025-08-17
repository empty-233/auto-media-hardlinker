<template>
  <div class="auth-container">
    <div class="auth-card">
      <!-- Logo和标题 -->
      <div class="auth-header">
        <div class="logo">
          <span class="logo-text">A M H</span>
        </div>
        <p class="app-name">Auto Media Hardlinker</p>
      </div>

      <!-- 登录表单 -->
      <div v-if="!showRegister" class="auth-form">
        <h1 class="form-title">欢迎回来</h1>
        <p class="form-subtitle">请登录到您的账户以继续使用</p>
        
        <!-- 登录错误提示 -->
        <div v-if="loginErrorMessage" class="error-message">
          <span>{{ loginErrorMessage }}</span>
        </div>
        
        <el-form 
          ref="loginFormRef" 
          :model="loginForm" 
          :rules="loginRules"
          size="large"
          @submit.prevent="handleLogin"
        >
          <el-form-item prop="username">
            <el-input
              v-model="loginForm.username"
              placeholder="请输入您的用户名"
              :prefix-icon="User"
              clearable
              @input="() => { loginError = false; loginErrorMessage = '' }"
            />
          </el-form-item>
          
          <el-form-item prop="password">
            <el-input
              v-model="loginForm.password"
              type="password"
              placeholder="请输入您的密码"
              :prefix-icon="Lock"
              :class="{ 'login-error': loginError }"
              show-password
              clearable
              @keyup.enter="handleLogin"
              @input="() => { loginError = false; loginErrorMessage = '' }"
            />
          </el-form-item>
          
          <el-form-item>
            <el-button
              type="primary"
              size="large"
              :loading="loading"
              @click="handleLogin"
              style="width: 100%"
            >
              <span v-if="!loading">登录</span>
              <span v-else>登录中...</span>
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 注册表单 -->
      <div v-else class="auth-form">
        <h1 class="form-title">初次设置</h1>
        <p class="form-subtitle">欢迎使用 Auto Media Hardlinker！<br>请创建管理员账户来开始使用。</p>
        
        <el-form 
          ref="registerFormRef" 
          :model="registerForm" 
          :rules="registerRules"
          size="large"
          @submit.prevent="handleRegister"
        >
          <el-form-item prop="username">
            <el-input
              v-model="registerForm.username"
              placeholder="请输入管理员用户名"
              :prefix-icon="User"
              clearable
            />
          </el-form-item>
          
          <el-form-item prop="password">
            <el-input
              v-model="registerForm.password"
              type="password"
              placeholder="请输入密码（至少6位）"
              :prefix-icon="Lock"
              show-password
              clearable
            />
          </el-form-item>
          
          <el-form-item prop="confirmPassword">
            <el-input
              v-model="registerForm.confirmPassword"
              type="password"
              placeholder="请再次输入密码"
              :prefix-icon="Key"
              show-password
              clearable
              @keyup.enter="handleRegister"
            />
          </el-form-item>
          
          <el-form-item>
            <el-button
              type="primary"
              size="large"
              :loading="loading"
              @click="handleRegister"
              style="width: 100%"
            >
              <span v-if="!loading">创建并开始使用</span>
              <span v-else>创建中...</span>
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { User, Lock, Key } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

// 路由
const router = useRouter()

// Store
const authStore = useAuthStore()

// 响应式数据
const showRegister = ref(false)
const loading = ref(false)
const loginError = ref(false) // 添加登录错误状态
const loginErrorMessage = ref('') // 添加登录错误消息

// 表单引用
const loginFormRef = ref<FormInstance>()
const registerFormRef = ref<FormInstance>()

// 登录表单
const loginForm = ref({
  username: '',
  password: ''
})

// 注册表单
const registerForm = ref({
  username: '',
  password: '',
  confirmPassword: ''
})

// 表单验证规则
const loginRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
}

const registerRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度在 3 到 20 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少 6 个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== registerForm.value.password) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

// 登录处理
const handleLogin = async () => {
  if (!loginFormRef.value) return
  
  const valid = await loginFormRef.value.validate()
  if (!valid) return
  
  try {
    loading.value = true
    loginError.value = false // 重置错误状态
    loginErrorMessage.value = '' // 清空错误消息
    await authStore.login(loginForm.value.username, loginForm.value.password)
    
    ElMessage.success('登录成功')
    router.push('/')
  } catch (error: unknown) {
    // 设置错误状态，触发视觉反馈
    loginError.value = true
    loginErrorMessage.value = '用户名或密码错误，请重新输入'
    // 清空密码字段，避免密码错误时保留在界面上
    loginForm.value.password = ''
    // 让密码输入框重新获得焦点，方便用户重新输入
    setTimeout(() => {
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement
      if (passwordInput) {
        passwordInput.focus()
      }
    }, 100)
    console.error('登录失败:', error)
  } finally {
    loading.value = false
  }
}

// 注册处理
const handleRegister = async () => {
  if (!registerFormRef.value) return
  
  const valid = await registerFormRef.value.validate()
  if (!valid) return
  
  try {
    loading.value = true
    await authStore.register(registerForm.value.username, registerForm.value.password)
    
    ElMessage.success('账户创建成功')
    router.push('/')
  } catch (error: unknown) {
    // HTTP客户端已经处理了错误消息显示，这里只需要记录日志
    console.error('创建账户失败:', error)
  } finally {
    loading.value = false
  }
}

// 检查初始化状态
const checkInitializationStatus = async () => {
  try {
    const data = await authStore.checkInitialization()
    showRegister.value = data.needsInitialization
  } catch (error) {
    console.error('检查初始化状态失败:', error)
    ElMessage.error('无法连接到服务器')
  }
}

// 组件挂载时检查状态
onMounted(() => {
  // 如果已经登录，直接跳转到首页
  if (authStore.isAuthenticated) {
    router.push('/')
    return
  }
  
  // 如果初始化状态已知，直接设置显示状态
  if (authStore.initialized !== null) {
    showRegister.value = !authStore.isInitialized
  } else {
    // 如果初始化状态未知，则主动检查（这种情况很少发生，因为路由守卫通常会先执行）
    checkInitializationStatus()
  }
})
</script>

<style scoped>
.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-background);
  padding: 20px;
  position: relative;
  transition: var(--color-transition);
}

.auth-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, 
    rgba(var(--el-color-primary-rgb), 0.1) 0%, 
    rgba(var(--el-color-primary-rgb), 0.05) 50%,
    rgba(var(--el-color-primary-rgb), 0.08) 100%);
  pointer-events: none;
}

.auth-card {
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  padding: 48px;
  width: 100%;
  max-width: 440px;
  position: relative;
  z-index: 1;
  backdrop-filter: blur(8px);
  transition: var(--color-transition);
}

html.dark .auth-card {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.auth-header {
  text-align: center;
  margin-bottom: 40px;
}

.logo {
  margin-bottom: 16px;
}

.logo-text {
  font-size: 48px;
  font-weight: bold;
  color: var(--el-color-primary);
  letter-spacing: 8px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.app-name {
  color: var(--color-text);
  font-size: 16px;
  margin: 0;
  opacity: 0.8;
  font-weight: 500;
}

.form-title {
  text-align: center;
  margin-bottom: 8px;
  color: var(--color-heading);
  font-size: 28px;
  font-weight: 600;
  transition: var(--color-transition);
}

.form-subtitle {
  text-align: center;
  color: var(--color-text);
  margin-bottom: 32px;
  font-size: 14px;
  opacity: 0.7;
  line-height: 1.5;
  transition: var(--color-transition);
}

.auth-form {
  margin-top: 0;
}

.error-message {
  background-color: rgba(var(--el-color-danger-rgb), 0.1);
  border: 1px solid var(--el-color-danger);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 20px;
  color: var(--el-color-danger);
  font-size: 14px;
  display: flex;
  align-items: center;
  animation: shake 0.6s ease-in-out;
}

.error-message::before {
  content: '⚠';
  margin-right: 8px;
  font-weight: bold;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
  20%, 40%, 60%, 80% { transform: translateX(2px); }
}

/* Element Plus 组件样式重写 */
:deep(.el-input) {
  margin-bottom: 4px;
}

:deep(.el-input__wrapper) {
  background-color: var(--color-background-mute);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: none;
  transition: var(--color-transition);
  padding: 12px 16px;
}

:deep(.el-input__wrapper:hover) {
  border-color: var(--color-border-hover);
}

:deep(.el-input__wrapper.is-focus) {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px rgba(var(--el-color-primary-rgb), 0.2);
}

/* 登录错误时的样式 */
:deep(.el-input.login-error .el-input__wrapper) {
  border-color: var(--el-color-danger) !important;
  box-shadow: 0 0 0 2px rgba(var(--el-color-danger-rgb), 0.2) !important;
}

:deep(.el-input.login-error .el-input__wrapper:hover) {
  border-color: var(--el-color-danger) !important;
}

:deep(.el-input.login-error .el-input__wrapper.is-focus) {
  border-color: var(--el-color-danger) !important;
  box-shadow: 0 0 0 2px rgba(var(--el-color-danger-rgb), 0.2) !important;
}

:deep(.el-input__inner) {
  height: 48px;
  color: var(--color-text);
  font-size: 16px;
  background-color: transparent;
  border: none;
  transition: var(--color-transition);
}

:deep(.el-input__inner::placeholder) {
  color: var(--color-text);
  opacity: 0.5;
}

:deep(.el-input__prefix) {
  color: var(--color-text);
  opacity: 0.6;
}

:deep(.el-button--primary) {
  background-color: var(--el-color-primary);
  border-color: var(--el-color-primary);
  border-radius: 12px;
  font-weight: 600;
  font-size: 16px;
  padding: 14px 24px;
  height: 56px;
  transition: all 0.3s ease;
}

:deep(.el-button--primary:hover) {
  background-color: var(--el-color-primary-light-3);
  border-color: var(--el-color-primary-light-3);
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(var(--el-color-primary-rgb), 0.3);
}

:deep(.el-button--primary:active) {
  transform: translateY(0);
}

:deep(.el-button--primary.is-loading) {
  transform: none;
}

:deep(.el-form-item) {
  margin-bottom: 24px;
}

:deep(.el-form-item__error) {
  color: var(--el-color-danger);
  font-size: 13px;
  margin-top: 6px;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .auth-container {
    padding: 16px;
  }
  
  .auth-card {
    padding: 32px 24px;
    max-width: 100%;
    margin: 0 auto;
  }
  
  .logo-text {
    font-size: 36px;
    letter-spacing: 6px;
  }
  
  .form-title {
    font-size: 24px;
  }
  
  .form-subtitle {
    font-size: 13px;
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

.auth-card {
  animation: fadeInUp 0.6s ease-out;
}

/* 高对比度模式支持 */
@media (prefers-contrast: high) {
  .auth-card {
    border-width: 2px;
  }
  
  :deep(.el-input__wrapper) {
    border-width: 2px;
  }
}

/* 减少动画模式支持 */
@media (prefers-reduced-motion: reduce) {
  .auth-card {
    animation: none;
  }
  
  :deep(.el-button--primary:hover) {
    transform: none;
  }
  
  * {
    transition: none !important;
  }
}
</style>
