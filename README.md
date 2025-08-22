# Auto Media Hardlinker

基于 LLM 的智能媒体文件管理工具，自动管理和创建硬链接。

## 目录

- [项目简介](#项目简介)
- [功能特点](#功能特点)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
  - [前置条件](#前置条件)
  - [基础配置](#基础配置)
  - [Windows 环境中文支持](#windows-环境中文支持)
- [部署指南](#部署指南)
  - [生产环境部署](#生产环境部署)
    - [1. 部署步骤](#1-部署步骤)
    - [2. 使用 PM2 进程管理](#2-使用-pm2-进程管理)
    - [3. Nginx 反向代理配置](#3-nginx-反向代理配置)
  - [Docker 部署（计划中）](#docker-部署计划中)
- [开发指南](#开发指南)
  - [开发环境设置](#开发环境设置)
    - [1. 环境要求](#1-环境要求)
    - [2. 初始步骤](#2-初始步骤)
    - [3. 项目结构](#3-项目结构)
    - [4. 开发命令](#4-开发命令)
- [高级使用](#高级使用)
  - [自定义 LLM 提示](#自定义-llm-提示)
  - [自定义正则表达式配置](#自定义正则表达式配置)
  - [实际使用案例](#实际使用案例)
- [待实现功能](#待实现功能)
  - [🚀 功能规划](#-功能规划)
  - [✅ 已完成优化](#-已完成优化)
- [许可证](#许可证)

## 项目简介

Auto Media Hardlinker 是一款使用 LLM 自动管理和整理媒体文件的工具。它可以监控指定目录中的新媒体文件，使用大语言模型(LLM)解析文件名，从 TMDB 获取详细信息，自动创建适当的目录结构和硬链接。

## 功能特点

- 🤖 基于 LLM 的智能媒体文件名解析（支持 Ollama 和 OpenAI）
- 🔍 自动识别电影、电视剧和媒体集合
- 📁 自动创建硬链接，保持文件系统高效
- 🔄 实时文件监控，自动处理新增文件
- 🌐 集成 TMDB API，自动获取媒体信息与元数据
- 📊 现代化 Web 前端界面，支持深色模式和移动端适配
- 🖼️ 自动下载和管理海报、背景图等媒体资源
- 📝 强化日志系统，支持实时查看和过滤
- ⚙️ 高级队列管理和任务调度系统
- 🔐 用户认证和权限管理
- 📈 仪表板统计和媒体库概览
- 🎛️ 灵活的配置管理，支持运行时更新

## 技术栈

- **后端**：Node.js + Express + TypeScript
- **前端**：Vue 3 + Element Plus + Vite
- **数据库**：SQLite + Prisma ORM
- **AI 集成**：支持 Ollama (本地推理) 和 OpenAI
- **媒体信息**：TMDB API
- **文件监控**：Chokidar
- **任务队列**：自定义队列管理系统
- **日志系统**：Pino + 持久化日志支持
- **用户认证**：JWT + bcrypt

## 快速开始

### 前置条件

- Node.js v18+
- PNPM 包管理器
- TMDB API 密钥（必需）
- Ollama 或 OpenAI API（可选，用于AI功能）

### 基础配置

1. **克隆项目**

```bash
git clone https://github.com/empty-233/auto-media-hardlinker.git
cd auto-media-hardlinker
```

2. **安装依赖**

```bash
pnpm install
```

3. **配置环境**

复制配置示例文件并编辑：

```bash
cp config/config.json.example config/config.json
cp .env.example .env
```

编辑 `config.json` 和 `.env` 文件，填写必要信息（详细配置说明请参考部署指南和开发指南）。

下面是 `config.json` 的一个配置示例：

```json
{
    //监听目录位置
    "monitorFilePath": "/file/monitor",
    //目标目录位置
    "targetFilePath": "/file/target",
    //是否持久化保存日志到文件(true/false)
    "persistentLogging": false,
    //tmdb api https://www.themoviedb.org/settings/api
    "tmdbApi": "your_tmdb_api_key",
    //tmdb 语言
    "language": "zh-CN",
    //是否使用LLM进行刮削(true/false)
    "useLlm": true,
    // LLM提供商，支持 "ollama" 或 "openai"
    "llmProvider": "ollama",
    // Ollama服务主机地址 (llmProvider为 "ollama" 时必填)
    "llmHost": "http://localhost:11434",
    // Ollama模型名称 (llmProvider为 "ollama" 时必填)
    "llmModel": "qwen2.5",
    // OpenAI API密钥 (llmProvider为 "openai" 时必填)
    "openaiApiKey": "your_openai_api_key",
    // OpenAI模型名称 (llmProvider为 "openai" 时必填)
    "openaiModel": "gpt-4-turbo",
    // OpenAI API基础URL (可选，用于代理)
    "openaiBaseUrl": "https://api.openai.com/v1",
    //支持的视频文件扩展名
    "videoExtensions": [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg", ".mpeg", ".ts"],
    //队列配置
    "queue": {
        // 并发工作进程数
        "concurrency": 1,
        // 重试基础延迟（毫秒）
        "retryDelay": 1000,
        // 最大重试延迟（毫秒）
        "maxRetryDelay": 300000,
        // 默认最大重试次数
        "defaultMaxRetries": 3,
        // 任务处理超时时间（毫秒）
        "processingTimeout": 300000,
        // 批量处理大小
        "batchSize": 10
    }
}
```

### Windows 环境中文支持

如果在 Windows 终端中遇到乱码问题，请根据您使用的终端执行以下命令来设置UTF-8编码：

- **PowerShell**:

  ```powershell
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  ```

- **CMD**:

  ```cmd
  chcp 65001
  ```

## 部署指南

### 生产环境部署

#### 1. 部署步骤

**克隆并安装：**

```bash
git clone https://github.com/empty-233/auto-media-hardlinker.git
cd auto-media-hardlinker
pnpm install
```

**配置环境：**

```bash
cp config/config.json.example config/config.json
cp .env.example .env
# 编辑配置文件，填写TMDB API密钥等必要信息
```

**初始化数据库：**

```bash
# 生成 Prisma 客户端
pnpm prisma:generate

# 初始化数据库
pnpm prisma migrate deploy
```

**构建应用：**

```bash
pnpm build
pnpm frontend:build
```

**启动服务：**

```bash
pnpm start
```

#### 2. 使用 PM2 进程管理

推荐使用 PM2 来管理生产环境的进程：

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start dist/index.js --name "auto-media-hardlinker"

# 设置开机自启
pm2 startup
pm2 save
```

#### 3. Nginx 反向代理配置

```nginx
server {
    listen 80;
    # 域名
    server_name your-domain.com;
    
    # 前端静态文件根目录(修改路径)
    root /frontend/dist;
    index index.html;

    # API 请求代理到后端
    location /api/ {
        proxy_pass http://localhost:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 前端路由处理（Vue Router History Mode）
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Docker 部署

您可以使用 Docker 和 Docker Compose 快速部署应用。

1.  **克隆项目**

    ```bash
    git clone https://github.com/empty-233/auto-media-hardlinker.git
    cd auto-media-hardlinker
    ```

2.  **配置 `docker-compose.yml`**

    编辑 `docker-compose.yml` 文件，根据您的实际情况修改卷（volumes）映射：

    ```yaml
    services:
      app:
        # ...
        volumes:
          - ./config:/app/config
          - ./data:/app/data
          - ./logs:/app/logs
          # 文件目录 - 请修改为你的实际路径
          - /path/to/your/file:/file
    ```

3.  **启动服务**

    ```bash
    docker-compose up -d
    ```

4.  **首次配置**

    容器首次启动后，默认配置文件会自动创建在 `./config/config.json`。需要在webui中配置。

## 开发指南

### 开发环境设置

#### 1. 环境要求

- Node.js 18+
- PNPM 包管理器

#### 2. 初始步骤

```bash
# 克隆项目
git clone https://github.com/empty-233/auto-media-hardlinker.git
cd auto-media-hardlinker

# 安装依赖
pnpm install

# 配置环境
cp config/config.json.example config/config.json
cp .env.example .env

# 初始化数据库
pnpm prisma:generate
pnpm prisma migrate deploy

# 启动开发服务器（同时启动前后端）
pnpm dev & pnpm frontend:dev
```

#### 3. 项目结构

```
├── src/                    # 后端源码
│   ├── config/            # 配置相关
│   ├── controllers/       # 控制器
│   ├── core/             # 核心业务逻辑
│   ├── middleware/       # 中间件
│   ├── queue/           # 队列管理
│   ├── services/        # 服务层
│   └── routes/          # 路由定义
├── frontend/            # 前端源码
│   ├── src/
│   │   ├── views/       # 页面组件
│   │   ├── components/  # 通用组件
│   │   ├── api/        # API 调用
│   │   └── stores/     # 状态管理
├── config/             # 配置文件
├── prisma/            # 数据库模型
└── public/           # 静态资源
```

#### 4. 开发命令

```bash
# 后端开发（自动重载）
pnpm dev

# 前端开发
pnpm frontend:dev

# 构建后端
pnpm build

# 构建前端
pnpm frontend:build

# 数据库相关
pnpm prisma:generate    # 生成 Prisma 客户端
pnpm prisma:push       # 推送数据库模式变更
```

## 高级使用

### 自定义 LLM 提示

您可以编辑`config/prompt.md`文件来自定义 LLM 的提示，以改进文件名解析逻辑。系统默认提供了一个优化的提示模板，适用于大多数常见的媒体文件命名格式。

### 自定义正则表达式配置

如果您不想使用 LLM 或需要更高效的文件名解析，可以通过编辑`config/regexConfig.ts`文件来自定义正则表达式规则

通过添加自定义的正则表达式规则，您可以处理特殊的文件命名格式。

### 实际使用案例

以下是一个实际使用案例：

当系统检测到文件`[Nekomoe kissaten&LoliHouse] Make Heroine ga Oosugiru! - 01 [WebRip 1080p HEVC-10bit AAC ASSx2].mkv`：

1. LLM 解析出标题"Make Heroine ga Oosugiru!"、季数 1、集数 1
2. 查询 TMDB 获取该动画的详细信息
3. 创建目录结构`targe/败犬女主太多了！/第 1 季`
4. 创建硬链接`败犬女主太多了！ S1E1 专业青梅竹马・八奈见杏菜的败相.mkv`
5. 下载并保存海报和剧集截图
6. 在数据库中记录媒体和文件信息

## 待实现功能

### 🚀 功能规划

- BD刮削

### ✅ 已完成

- ✅ Docker 部署支持
- ✅ 大文件处理性能优化
- ✅ 内存使用优化
- ✅ 异常情况下的错误恢复
- ✅ 网络中断时的重连机制

## 许可证

MIT
