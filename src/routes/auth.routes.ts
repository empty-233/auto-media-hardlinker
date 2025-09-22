import { Router } from 'express'
import { AuthController } from '../controllers/auth.controller'
import { AuthService } from '../services'
import { createValidator } from '../middleware/validation.middleware';
import { AuthBodyValidators } from '../validators';

const authService = new AuthService();
const authController = new AuthController(authService);

const router = Router()

// 检查是否需要初始化
router.get('/check-init', authController.checkInitialization)

// 用户注册（仅在初始化时允许）
router.post(
  '/register',
  createValidator({
    body: AuthBodyValidators.register
  }),
  authController.register
)

// 用户登录
router.post(
  '/login',
  createValidator({
    body: AuthBodyValidators.login
  }),
  authController.login
)

// 获取当前用户信息（需要认证）
router.get('/me', authController.getCurrentUser)

export default router