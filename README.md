# Auto Media Hardlinker

基于 LLM 的智能媒体文件管理工具，自动管理和创建硬链接。

## 目录

- [项目简介](#项目简介)
- [功能特点](#功能特点)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
  - [前置条件](#前置条件)
  - [安装步骤](#安装步骤)
  - [配置文件](#配置文件)
- [高级使用](#高级使用)
- [待实现与待修复功能](#待实现与待修复功能)
- [许可证](#许可证)

## 项目简介

Auto Media Hardlinker 是一款使用 LLM 自动管理和整理媒体文件的工具。它可以监控指定目录中的新媒体文件，使用大语言模型(LLM)解析文件名，从 TMDB 获取详细信息，自动创建适当的目录结构和硬链接。

## 功能特点

- 🤖 基于 LLM 的智能媒体文件名解析
- 🔍 自动识别电影、电视剧和媒体集合
- 📁 自动创建硬链接，保持文件系统高效
- 🔄 实时文件监控，自动处理新增文件
- 🌐 集成 TMDB API，自动获取媒体信息与元数据
- 📊 直观的 Web 前端界面，轻松管理媒体库
- 🖼️ 自动下载和管理海报、背景图等媒体资源
- 📝 详细日志记录，便于问题排查

## 技术栈

- **后端**：Node.js + Express + TypeScript
- **前端**：Vue 3
- **数据库**：SQLite + Prisma ORM
- **AI 集成**：Ollama (本地 LLM 推理)
- **媒体信息**：TMDB API
- **文件监控**：Chokidar

## 快速开始

### 前置条件

- Node.js v18+
- PNPM
- TMDB API 密钥
- Ollama (可选)

### 安装步骤

1. **克隆仓库**

```bash
git clone https://github.com/empty-233/auto-media-hardlinker.git
cd auto-media-hardlinker
```

2. **安装依赖**

```bash
pnpm install
```

3. **配置**

复制配置示例文件并编辑：

```bash
cp config/config.json.example config/config.json
cp .env.example .env
```

编辑`config.json`文件和`.env`文件，填写必要信息。

4. **初始化数据库**

```bash
# 生成Prisma客户端
pnpm prisma:generate
```

5. **构建项目**

```bash
# 构建后端
pnpm build

# 构建前端
pnpm frontend:build
```

6. **启动应用**

```bash
# 启动后端
pnpm start
```

开发模式：

```bash
# 后端开发模式（自动重载）
pnpm dev

# 前端开发模式
pnpm frontend:dev
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

### 配置文件

配置文件`config.json`需要设置以下参数：

```json
{
  "monitorFilePath": "./file", // 监控的媒体文件目录
  "targetFilePath": "./target", // 硬链接目标目录（注意：原文中是"targe"，已修正为"target"）
  "tmdbApi": "your_tmdb_api_key", // TMDB API密钥
  "language": "zh-CN", // 媒体信息语言代码
  "useLlm": true, // 是否使用LLM进行解析（默认开启）
  "llmHost": "http://localhost:11434", // LLM服务地址，需要自己配置
  "llmModel": "qwen2.5" // 使用的LLM模型
}
```

> **注意**：LLM 功能默认开启（`useLlm: true`），您需要正确配置`llmHost`指向您的 Ollama 服务地址。请确保在使用前已正确安装并启动 Ollama 服务，默认地址为`http://localhost:11434`。如果 Ollama 部署在其他机器或使用不同端口，请相应修改此配置。

`.env`文件配置：

```
# 数据库URL
DATABASE_URL="file:./dev.db"
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

## 待实现与待修复功能

### 待实现功能

1. 前端修改文件媒体信息
2. Docker 部署支持

### 待修复功能

1. 传统模式多个数据处理
2. 日志系统优化

## 许可证

MIT
