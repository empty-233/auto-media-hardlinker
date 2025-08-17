import { Router } from 'express'
import { AuthController } from '../controllers/auth.controller'
import { AuthService } from '../services'
import { authenticateToken } from '../middleware/auth.middleware'

const authService = new AuthService();
const authController = new AuthController(authService);

const router = Router()

// 检查是否需要初始化
router.get('/check-init', authController.checkInitialization)

// 用户注册（仅在初始化时允许）
router.post('/register', authController.register)

// 用户登录
router.post('/login', authController.login)

// 获取当前用户信息（需要认证）
router.get('/me', authenticateToken, authController.getCurrentUser)

export default router
