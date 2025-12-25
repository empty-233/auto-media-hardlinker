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
  - [配置说明](#配置说明)
  - [部署指南](#部署指南)
    - [Docker 部署（推荐）](#docker-部署推荐)
      - [方式一：使用 Docker Compose（推荐）](#方式一使用-docker-compose推荐)
      - [方式二：使用 Docker 命令行](#方式二使用-docker-命令行)
      - [自行构建镜像（可选）](#自行构建镜像可选)
    - [源码部署](#源码部署)
      - [前置条件](#前置条件)
      - [1. 部署步骤](#1-部署步骤)
      - [2. 使用 PM2 进程管理](#2-使用-pm2-进程管理)
      - [3. Nginx 反向代理配置](#3-nginx-反向代理配置)
      - [Windows 环境中文支持](#windows-环境中文支持)
  - [开发指南](#开发指南)
    - [快速上手](#快速上手)
    - [项目结构](#项目结构)
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

> **⚠️ 实验性功能警告**
>
> BDMV/DVD/ISO 特殊文件夹处理功能目前处于实验阶段，可能存在以下问题：
>
> - 文件识别可能不准确
> - 某些特殊命名格式可能无法正确处理
> - 多卷内容的关联可能出现异常
> - 可能会产生预期之外的目录结构或硬链接
>
> 如遇到问题，请在 GitHub Issues 中反馈。

## 功能特点

- **智能文件解析**：基于 LLM 识别媒体文件名（支持 Ollama 和 OpenAI）
- **自动硬链接管理**：自动创建规范的目录结构和硬链接，保持文件系统高效
- **实时监控与定期扫描**：支持文件监控和自定义间隔扫描，自动处理新增文件
- **媒体信息集成**：集成 TMDB API，自动下载海报、背景图并生成 NFO 元数据文件
- **现代化 Web 界面**：支持深色模式和移动端适配，提供仪表板统计和媒体库管理
- **任务队列系统**：高级队列管理和任务调度，支持并发处理和失败重试

## 配置说明

`config.json` 是项目的核心配置文件。

> **⚠️ 路径配置重要说明**
>
> - **Docker 部署**：请保持 `monitorFilePath` 和 `targetFilePath` 默认值。**确保监听目录和目标在同一个层级避免权限问题**。
> - **源码部署**：请将这两个路径修改为您宿主机上的实际绝对路径。

下面是 `config.json` 的完整配置示例：

```json
{
    //监听目录位置 (Docker部署请保持默认，源码部署请修改为实际路径)
    "monitorFilePath": "/file/monitor",
    //目标目录位置 (Docker部署请保持默认，源码部署请修改为实际路径)
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

## 部署指南

### Docker 部署（推荐）

推荐使用 Docker 部署，支持多架构（amd64/arm64）。

- **Docker Hub**: `kongwu233/auto-media-hardlinker`
- **GitHub Container Registry**: `ghcr.io/empty-233/auto-media-hardlinker`

#### 方式一：使用 Docker Compose（推荐）

1. **准备工作目录**

   ```bash
   # 创建并进入项目目录
   mkdir -p auto-media-hardlinker && cd auto-media-hardlinker

   # 下载 docker-compose.yml
   wget https://raw.githubusercontent.com/empty-233/auto-media-hardlinker/main/docker-compose.yml
   ```

2. **启动服务**

   ```bash
   docker-compose up -d
   ```
   
   容器首次启动时，会自动在 `config` 目录下生成默认配置文件。

3. **修改配置**

   - **编辑 `docker-compose.yml`**：

     重点修改 `volumes` 部分，将宿主机的实际路径映射到容器内部：

     ```yaml
     services:
       auto-media-hardlinker:
         # ...
         volumes:
           - ./config:/app/config           # 配置文件目录
           - ./data:/app/data               # 数据库和数据目录
           - ./public:/app/public           # 静态资源（海报等）
           - ./logs:/app/logs               # 日志目录
           - /your/media/monitor:/file/monitor  # [必改] 监控目录（源文件）
           - /your/media/link:/file/target      # [必改] 目标目录（硬链接生成位置）
     ```

   - **编辑 `config/config.json`**：填入 TMDB API Key 和 LLM 相关配置（参考上文[配置说明](#配置说明)）。
   - **重启容器**：修改配置后需要重启容器使生效。
  
     ```bash
     docker-compose restart
     ```

4. **访问管理界面**

   浏览器访问 `http://localhost:8080`。

#### 方式二：使用 Docker 命令行

如果不使用 Docker Compose，可以直接运行容器：

```bash
# 1. 准备目录
mkdir -p config data logs

# 2. 启动容器
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

# 3. 修改配置
# 编辑 config/config.json 后重启容器
docker restart auto-media-hardlinker
```

#### 自行构建镜像（可选）

```bash
git clone https://github.com/empty-233/auto-media-hardlinker.git
cd auto-media-hardlinker
docker-compose up -d --build
```

> **注意**：自行构建将使用仓库中的最新代码，可能不是稳定版本。建议使用预构建的镜像。

### 源码部署

#### 前置条件

- Node.js v22+
- PNPM 包管理器
- TMDB API 密钥（必需）
- Ollama 或 OpenAI API（可选，用于AI功能）

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

> **注意**：
>
> - 修改 `config.json` 中的 `monitorFilePath` 和 `targetFilePath` 为实际绝对路径。
> - 修改 `.env` 中的 `IMAGE_BASE_URL` 地址和端口。

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

#### Windows 环境中文支持

如果在 Windows 终端中遇到乱码问题，请根据您使用的终端执行以下命令来设置UTF-8编码：

- **PowerShell**:

  ```powershell
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  ```

- **CMD**:

  ```cmd
  chcp 65001
  ```

## 开发指南

### 快速上手

1. **环境准备**：确保已安装 Node.js v22+ 和 PNPM。
2. **项目安装**：参考 [源码部署](#源码部署) 章节完成代码克隆、依赖安装和配置文件设置。
3. **启动开发模式**：

   ```bash
   # 同时启动后端和前端（开发模式）
   pnpm dev & pnpm frontend:dev
   ```

### 项目结构

``` txt
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

## 高级使用

### 定期扫描配置

通过 `config.json` 中的 `scanConfig` 配置定期扫描：

| 配置项 | 说明 | 推荐值 |
| --- | --- | --- |
| `enabled` | 是否启用定期扫描 | `true` |
| `interval` | 扫描间隔（分钟） | 60-1440 |
| `concurrency` | 并发处理数 | 1-5 |
| `scanMaxDepth` | 扫描最大深度 | 2 |

Web 界面支持手动触发扫描、实时查看日志和动态更新配置，无需重启服务。

### 自定义 LLM 提示

编辑提示词文件以优化识别效果：

- `config/prompt.md` - 普通文件名解析提示词
- `config/specialFolderPrompt.md` - BDMV/DVD/ISO 特殊文件夹识别提示词

系统默认提供优化的提示模板，适用于大多数常见的媒体文件命名格式。您可以根据实际需求调整提示词，改进 LLM 的解析准确度。

### 自定义正则表达式配置

如果您不想使用 LLM 或需要更高效的文件名解析，可以通过编辑`config/regexConfig.ts`文件来自定义正则表达式规则

通过添加自定义的正则表达式规则，您可以处理特殊的文件命名格式。

### BDMV/DVD/ISO 特殊文件夹处理

支持处理蓝光原盘（BDMV）、DVD 原盘（VIDEO_TS）和 ISO 镜像文件：

- **多卷识别**：自动处理 Vol.1、Vol.2、Disc 1、Disc 2 等多卷内容
- **特典分类**：识别特典、SP、OVA、PV、Menu 等特殊内容
- **智能判断**：通过 LLM 自动判断内容类型（主要内容/特典/菜单等）
- **规范链接**：为每个卷或特典创建规范的硬链接结构

通过编辑 `config/specialFolderPrompt.md` 自定义识别规则。

### 实际使用案例

**文件处理工作流**：

以下是一个实际使用案例：

当系统检测到文件`[Nekomoe kissaten&LoliHouse] Make Heroine ga Oosugiru! - 01 [WebRip 1080p HEVC-10bit AAC ASSx2].mkv`：

1. LLM 解析出标题"Make Heroine ga Oosugiru!"、季数 1、集数 1
2. 查询 TMDB 获取该动画的详细信息
3. 创建目录结构`target/败犬女主太多了！/第 1 季`
4. 创建硬链接`败犬女主太多了！ S1E1 专业青梅竹马・八奈见杏菜的败相.mkv`
5. 自动生成 NFO 元数据文件`败犬女主太多了！ S1E1 专业青梅竹马・八奈见杏菜的败相.nfo`
6. 下载并保存海报和剧集截图
7. 在数据库中记录媒体和文件信息

支持定期扫描功能，会按配置的间隔时间自动扫描监控目录，发现新文件后自动处理，确保无人值守时也能及时处理新增的媒体文件。

## 待办事项

### 功能规划

- [ ] LLM判断多个媒体情况
- [ ] 特殊文件 NFO 文件支持
- [ ] 完善特殊文件处理

### 已完成

- [x] 定期扫描
- [x] Docker 部署支持
- [x] 大文件处理性能优化
- [x] 内存使用优化
- [x] 异常情况下的错误恢复
- [x] 网络中断时的重连机制
- [x] 蓝光原盘（BDMV/ISO）刮削支持
- [x] 特殊类型手动修改关联
- [x] NFO 元数据文件自动生成
- [x] 未关联文件手动关联

## 许可证

GPL-3.0
