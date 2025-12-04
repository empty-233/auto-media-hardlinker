# Auto Media Hardlinker

[![GitHub license](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](https://github.com/empty-233/auto-media-hardlinker/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/empty-233/auto-media-hardlinker.svg)](https://github.com/empty-233/auto-media-hardlinker/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/empty-233/auto-media-hardlinker.svg)](https://github.com/empty-233/auto-media-hardlinker/network/members)

基于 LLM 的智能媒体文件管理工具，自动识别媒体信息并创建硬链接。

## 目录

- [Auto Media Hardlinker](#auto-media-hardlinker)
  - [目录](#目录)
  - [项目简介](#项目简介)
  - [功能特点](#功能特点)
  - [技术栈](#技术栈)
  - [快速开始](#快速开始)
    - [前置条件](#前置条件)
    - [基础配置](#基础配置)
    - [Windows 环境中文支持](#windows-环境中文支持)
  - [部署指南](#部署指南)
    - [Docker 部署（推荐）](#docker-部署推荐)
      - [方式一：使用 Docker Compose（推荐）](#方式一使用-docker-compose推荐)
      - [方式二：使用 Docker 命令行](#方式二使用-docker-命令行)
      - [自行构建镜像（可选）](#自行构建镜像可选)
    - [生产环境部署](#生产环境部署)
      - [1. 部署步骤](#1-部署步骤)
      - [2. 使用 PM2 进程管理](#2-使用-pm2-进程管理)
      - [3. Nginx 反向代理配置](#3-nginx-反向代理配置)
  - [开发指南](#开发指南)
    - [环境要求](#环境要求)
    - [初始步骤](#初始步骤)
    - [项目结构](#项目结构)
    - [开发命令](#开发命令)
  - [高级使用](#高级使用)
    - [定期扫描配置](#定期扫描配置)
    - [自定义 LLM 提示](#自定义-llm-提示)
    - [自定义正则表达式配置](#自定义正则表达式配置)
    - [BDMV/DVD/ISO 特殊文件夹处理](#bdmvdvdiso-特殊文件夹处理)
    - [实际使用案例](#实际使用案例)
  - [待办事项](#待办事项)
    - [功能规划](#功能规划)
    - [已完成](#已完成)
  - [许可证](#许可证)

## 项目简介

Auto Media Hardlinker 是一款使用大语言模型（LLM）自动管理和整理媒体文件的工具。它能够监控指定目录，当新媒体文件出现时，通过 LLM 解析文件名，从 TMDB 获取详细的媒体信息，并自动创建规范的目录结构和硬链接。

## 功能特点

- 基于 LLM 的智能媒体文件名解析（支持 Ollama 和 OpenAI）
- 自动识别电影、电视剧和媒体集合
- 自动创建硬链接，保持文件系统高效
- 实时文件监控，自动处理新增文件
- 智能定期扫描系统，支持自定义间隔和并发处理，扫描历史记录和库文件管理
- 集成 TMDB API，自动获取媒体信息与元数据
- 现代化 Web 前端界面，支持深色模式和移动端适配
- 自动下载和管理海报、背景图等媒体资源
- 强化日志系统，支持实时查看和过滤
- 高级队列管理和任务调度系统
- 用户认证和权限管理
- 仪表板统计和媒体库概览
- 灵活的配置管理，支持运行时更新

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

- Node.js v22+
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
    //支持的字幕文件扩展名
    "subtitleExtensions": [".srt", ".ass", ".ssa", ".sub", ".idx", ".vtt", ".sup"],
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
    },
    //定期扫描配置
    "scanConfig": {
        // 是否启用定期扫描
        "enabled": true,
        // 扫描间隔（分钟）
        "interval": 360,
        // 扫描并发数
        "concurrency": 3,
        // 扫描最大深度（子目录层级）
        "scanMaxDepth": 2
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

### Docker 部署（推荐）

推荐使用 Docker 部署，可从以下平台拉取：

- **Docker Hub**: `kongwu233/auto-media-hardlinker`
- **GitHub Container Registry**: `ghcr.io/empty-233/auto-media-hardlinker`

#### 方式一：使用 Docker Compose（推荐）

1. **创建项目目录并下载配置文件**

    ```bash
    # 创建项目目录
    mkdir -p auto-media-hardlinker/config
    cd auto-media-hardlinker
    
    # 下载 docker-compose.yml
    wget https://raw.githubusercontent.com/empty-233/auto-media-hardlinker/main/docker-compose.yml
    
    # 下载配置文件
    wget -P config/config.json https://raw.githubusercontent.com/empty-233/auto-media-hardlinker/main/config/config.json.example
    wget -P config https://raw.githubusercontent.com/empty-233/auto-media-hardlinker/main/config/prompt.md
    wget -P config https://raw.githubusercontent.com/empty-233/auto-media-hardlinker/main/config/specialFolderPrompt.md
    wget -P config https://raw.githubusercontent.com/empty-233/auto-media-hardlinker/main/config/regexConfig.ts
    ```

2. **编辑 `docker-compose.yml`**

    根据实际情况修改卷映射路径，特别是监控目录和目标目录：

    ```yaml
    volumes:
      - /path/to/your/monitor:/file/monitor  # 修改为你的监控目录
      - /path/to/your/target:/file/target    # 修改为你的目标目录
    ```

3. **启动服务**

    ```bash
    docker-compose up -d
    ```

4. **查看日志**

    ```bash
    docker-compose logs -f
    ```

5. **访问 WebUI**

    打开浏览器访问 `http://localhost:8080`（端口可在 `docker-compose.yml` 中修改）

> **提示**：
>
> - Docker 容器启动时会自动执行数据库迁移（`prisma migrate deploy`）
> - 下载的配置文件说明：
>   - `config.json.example` - 主配置文件示例
>   - `prompt.md` - LLM 提示词模板（用于普通文件）
>   - `specialFolderPrompt.md` - 特殊文件夹识别提示词（用于 BDMV/DVD/ISO）
>   - `regexConfig.ts` - 正则表达式配置
> - 首次启动会自动生成 `config.json`，可在 WebUI 中修改配置
> - 也可以手动复制 `config.json.example` 并重命名为 `config.json` 后修改

#### 方式二：使用 Docker 命令行

```bash
# 创建项目目录
mkdir -p auto-media-hardlinker/config
cd auto-media-hardlinker

# 下载配置文件
curl -o config/config.json https://raw.githubusercontent.com/empty-233/auto-media-hardlinker/main/config/config.json.example
curl -o config https://raw.githubusercontent.com/empty-233/auto-media-hardlinker/main/config/prompt.md
curl -o config https://raw.githubusercontent.com/empty-233/auto-media-hardlinker/main/config/specialFolderPrompt.md
curl -o config https://raw.githubusercontent.com/empty-233/auto-media-hardlinker/main/config/regexConfig.ts

# 启动容器
docker run -d \
  --name auto-media-hardlinker \
  --restart unless-stopped \
  -p 8080:80 \
  -v $(pwd)/config:/app/config \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/public:/app/public \
  -v /path/to/your/monitor:/file/monitor \
  -v /path/to/your/target:/file/target \
  -e NODE_ENV=production \
  -e TZ=Asia/Shanghai \
  kongwu233/auto-media-hardlinker:latest
```

#### 自行构建镜像（可选）

如果需要使用最新的开发代码或自定义构建，需要克隆完整项目：

```bash
# 克隆完整项目（包含源码）
git clone https://github.com/empty-233/auto-media-hardlinker.git
cd auto-media-hardlinker

# 使用 Docker Compose 构建并启动
docker-compose up -d --build

# 或使用 Docker 命令构建
docker build -t auto-media-hardlinker:custom .
```

> **注意**：自行构建将使用仓库中的最新代码，可能不是稳定版本。建议使用预构建的镜像。

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

> **注意**：修改`IMAGE_BASE_URL`地址和端口

**初始化数据库：**

```bash
# 生成 Prisma 客户端
pnpm prisma:generate

# 应用数据库迁移（生产环境）
pnpm prisma migrate deploy
```

> **注意**：`prisma migrate deploy` 会应用所有待执行的迁移，适用于生产环境。该命令不会创建新的迁移文件，只会执行 `prisma/migrations` 目录中已有的迁移。

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
    
    # 静态资源 (图片等)
    location /public/ {
        alias /app/public/;
        expires 7d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

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

## 开发指南

### 环境要求

- Node.js 22+
- PNPM 包管理器

### 初始步骤

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
pnpm prisma db push

# 启动开发服务器（同时启动前后端）
pnpm dev & pnpm frontend:dev
```

### 项目结构

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

### 开发命令

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
pnpm prisma migrate dev # 创建新的迁移并应用（开发环境）
pnpm prisma migrate deploy # 应用已有迁移（生产环境）
```

## 高级使用

### 定期扫描配置

系统提供了智能的定期扫描功能，可以自动监控和处理新增的媒体文件：

- **启用/禁用**：通过 `scanConfig.enabled` 控制定期扫描的开关
- **扫描间隔**：`scanConfig.interval` 设置扫描间隔（单位：分钟）
  - 建议值：60分钟（每小时）到 1440分钟（每天）
  - 系统会根据配置自动在后台执行扫描
- **并发处理**：`scanConfig.concurrency` 控制扫描时的并发文件处理数量
  - 建议根据系统性能设置，通常1-5个并发即可

**Web界面管理**：

- 支持手动触发扫描，无需等待定期调度
- 实时查看扫描日志和库文件管理
- 支持配置的动态更新，无需重启服务

### 自定义 LLM 提示

您可以编辑 `config/prompt.md` 和 `config/specialFolderPrompt.md` 文件来自定义 LLM 的提示，以改进文件名解析逻辑。系统默认提供了一个优化的提示模板，适用于大多数常见的媒体文件命名格式。

### 自定义正则表达式配置

如果您不想使用 LLM 或需要更高效的文件名解析，可以通过编辑`config/regexConfig.ts`文件来自定义正则表达式规则

通过添加自定义的正则表达式规则，您可以处理特殊的文件命名格式。

### BDMV/DVD/ISO 特殊文件夹处理

支持理蓝光原盘（BDMV）、DVD 原盘（VIDEO_TS）和 ISO 镜像文件

**高级特性：**

- **多卷支持**：自动识别和处理多卷蓝光（Vol.1、Vol.2、Disc 1、Disc 2 等）
- **特典内容**：支持识别特典、SP、OVA、PV、Menu 等特殊内容
- **智能分类**：通过 LLM 自动判断内容类型（主要内容/特典/菜单等）
- **硬链接整合**：自动为每个卷或特典创建规范的硬链接结构

**配置文件：**

使用 `config/specialFolderPrompt.md` 文件来定义 LLM 识别特殊文件夹的规则。可以根据需要自定义识别规则和提示模板。

### 实际使用案例

**文件处理工作流**：

以下是一个实际使用案例：

当系统检测到文件`[Nekomoe kissaten&LoliHouse] Make Heroine ga Oosugiru! - 01 [WebRip 1080p HEVC-10bit AAC ASSx2].mkv`：

1. LLM 解析出标题"Make Heroine ga Oosugiru!"、季数 1、集数 1
2. 查询 TMDB 获取该动画的详细信息
3. 创建目录结构`target/败犬女主太多了！/第 1 季`
4. 创建硬链接`败犬女主太多了！ S1E1 专业青梅竹马・八奈见杏菜的败相.mkv`
5. 下载并保存海报和剧集截图
6. 在数据库中记录媒体和文件信息

支持定期扫描功能，会按配置的间隔时间自动扫描监控目录，发现新文件后自动处理，确保无人值守时也能及时处理新增的媒体文件。

## 待办事项

### 功能规划

- [ ] 未关联文件手动关联
- [ ] LLM判断多个媒体情况
- [ ] NFO 文件支持

### 已完成

- [x] 定期扫描
- [x] Docker 部署支持
- [x] 大文件处理性能优化
- [x] 内存使用优化
- [x] 异常情况下的错误恢复
- [x] 网络中断时的重连机制
- [x] 蓝光原盘（BDMV/ISO）刮削支持
- [x] 特殊类型手动修改关联

## 许可证

GPL-3.0
