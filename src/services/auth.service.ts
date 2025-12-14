import bcrypt from "bcrypt";
import prisma from "@/client";
import { generateToken } from "@/utils/jwt";
import { logger } from "@/utils/logger";

interface LoginData {
  username: string;
  password: string;
}

interface RegisterData {
  username: string;
  password: string;
}

interface UserInfo {
  id: number;
  username: string;
  createdAt?: Date;
}

interface AuthResponse {
  token: string;
  user: {
    id: number;
    username: string;
  };
}

interface InitializationStatus {
  needsInitialization: boolean;
  userCount: number;
}

export class AuthService {
  // 用户登录
  async login(loginData: LoginData): Promise<AuthResponse> {
    const { username, password } = loginData;

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new Error("用户名或密码错误");
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error("用户名或密码错误");
    }

    // 生成JWT令牌
    const token = generateToken({
      userId: user.id,
      username: user.username,
    });

    logger.info(`用户 ${username} 登录成功`);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    };
  }

  // 用户注册（仅在没有用户时允许）
  async register(registerData: RegisterData): Promise<AuthResponse> {
    const { username, password } = registerData;

    if (password.length < 6) {
      throw new Error("密码长度不能少于6位");
    }

    // 检查是否已存在用户
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      throw new Error("系统已有用户，无法注册新用户");
    }

    // 密码加密
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
      },
    });

    // 生成JWT令牌
    const token = generateToken({
      userId: user.id,
      username: user.username,
    });

    logger.info(`用户 ${username} 注册成功`);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    };
  }

  // 获取当前用户信息
  async getCurrentUser(userId: number): Promise<UserInfo> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error("用户不存在");
    }

    return user;
  }

  // 检查是否需要初始化用户
  async checkInitialization(): Promise<InitializationStatus> {
    const userCount = await prisma.user.count();

    return {
      needsInitialization: userCount === 0,
      userCount,
    };
  }
}
