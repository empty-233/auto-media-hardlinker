# =================================================================
# Stage 1: 构建阶段 (Builder)
# =================================================================
# 使用官方Node.js 20镜像作为构建环境
FROM node:22-alpine AS builder

# 安装 pnpm
RUN npm install -g pnpm

# 设置工作目录
WORKDIR /app

# 复制所有 package 文件
COPY package.json pnpm-lock.yaml ./
COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/

# 安装所有依赖
RUN pnpm install --frozen-lockfile
RUN cd frontend && pnpm install --frozen-lockfile

# 复制所有源码和配置文件
COPY src ./src
COPY tsconfig.json ./tsconfig.json
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY config ./config
COPY frontend ./frontend

# 执行构建命令，生成产物
RUN pnpm prisma:generate && \
    pnpm build && \
    pnpm frontend:build

# =================================================================
# Stage 2: 运行阶段 (Runner)
# =================================================================
# 从一个干净的 alpine 镜像开始
FROM node:22-alpine

# 设置环境变量
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/dev.db"

# 安装运行时的必要工具 (nginx 和 wget 用于健康检查)
RUN npm install -g pnpm && \
    apk add --no-cache nginx wget

# 设置工作目录
WORKDIR /app

# 从构建阶段复制 package.json，并只安装生产环境依赖
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
RUN apk add --no-cache --virtual .build-deps python3 build-base && \
    pnpm install --prod --frozen-lockfile && \
    apk del .build-deps

# 从构建阶段复制构建好的产物
# 1. 复制后端代码 (dist 目录)
COPY --from=builder /app/dist ./
# 2. 复制 Prisma schema 用于数据库迁移
COPY --from=builder /app/prisma ./prisma
# 3. 复制前端构建产物 (假设 Nginx 会服务这个目录)
COPY --from=builder /app/frontend/dist ./frontend

COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma

# 运行数据库迁移
RUN pnpm prisma generate

# 创建运行时所需的目录
RUN mkdir -p /app/data /app/db_init

# 生成临时数据库
RUN DATABASE_URL="file:/app/db_init/dev.db" pnpm prisma db push

# 复制 Nginx 配置文件
COPY docker/http.d/ /etc/nginx/http.d/

# 复制 配置文件
COPY config/config.json.example /app/config/config.json.example
COPY config/prompt.md /app/config/prompt.md
COPY .env.example /app/.env

# 替换 .env 文件中的 DATABASE_URL 为容器中的路径
RUN sed -i 's|DATABASE_URL="file:./dev.db"|DATABASE_URL="file:/app/data/dev.db"|g' /app/.env

# 修改配置文件夹名称
RUN mv /app/config /app/config.example

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh
# 设置容器的入口点
ENTRYPOINT ["/app/start.sh"]

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# 启动命令
# 注意：您的原始 CMD 只会启动 Node.js。如果需要同时运行 Nginx，请参考下面的改进建议。
CMD ["node", "/app/src/index.js"]