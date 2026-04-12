# 乡音伴旅 (Xiangyin Banlv)

一款记录和分享地方声音与方言的文化旅行社交 App，基于 Expo (React Native) + Express + PostgreSQL 构建。

---

## 快速上手（本地部署）

### 第一步：克隆项目

#### 一、前置准备

##### 1. 环境要求

- 安装 Git（[下载地址](https://git-scm.com/downloads)），安装后在终端执行 `git --version` 验证是否安装成功；
- 目标电脑已联网，且能访问 GitHub；
- 拥有 GitHub 账号（与仓库所属账号一致），并生成过带 `repo` 权限的个人访问令牌（PAT）。

##### 2. 配置 Git 全局信息（首次使用必做）

打开终端 / 命令提示符，执行以下命令（替换为你的 GitHub 用户名和邮箱）：

```bash
git config --global user.name "你的GitHub用户名"
git config --global user.email "你的GitHub绑定邮箱"
```

#### 二、核心操作流程

##### 步骤 1：克隆 GitHub 仓库到本地

1. 打开 GitHub 仓库页面（如 `https://github.com/lhq13152961500-beep/EIRCT-ICMP`）；
2. 点击右上角「Code」→ 复制「HTTPS」地址（`https://github.com/lhq13152961500-beep/EIRCT-ICMP.git`）；
3. 在本地选择一个空文件夹（如 `D:\my-project`），右键打开「Git Bash Here」（Windows）/ 终端（Mac/Linux），执行克隆命令：

```bash
git clone https://github.com/lhq13152961500-beep/EIRCT-ICMP.git
```

1. 克隆完成后，进入仓库目录：

```bash
cd EIRCT-ICMP
```

##### 步骤 2：本地修改代码

- 用编辑器（VS Code/Replit 等）打开克隆后的文件夹，按需修改代码（新增功能、修复 bug 等）；
- 建议修改后先本地测试，确保功能正常。

##### 步骤 3：提交本地修改到 Git 仓库

1. 查看修改的文件（确认要提交的内容）：

```bash
git status
```

2. 暂存所有修改的文件（`.` 表示所有文件，也可指定单个文件如 `git add App.js`）：

```bash
git add .
```

3. 提交暂存的修改（必须填写有意义的提交说明）：

```bash
git commit -m "修改说明：比如修复数据库API调用问题、新增XX功能 2026.XX.XX"
```

##### 步骤 4：拉取远程最新代码（避免冲突）

在推送前，先拉取 GitHub 仓库的最新代码（防止多人协作时冲突）：

```bash
git pull origin main
```

- 若主分支是 `master`，替换为 `git pull origin master`。

##### 步骤 5：推送到 GitHub 仓库

###### 方式 1：使用 PAT 令牌推送（推荐）

执行推送命令后，终端会提示输入用户名和密码：

```bash
git push origin main
```

- `Username`：输入你的 GitHub 用户名（如 `lhq13152961500-beep`）；

- `Password`：输入你的 GitHub 个人访问令牌（PAT，以 `ghp_` 开头，不是登录密码）。

###### 方式 2：绑定 PAT 到远程地址（免重复输入）

若想后续推送无需重复输入令牌，先执行以下命令绑定（替换为你的 PAT）：

```bash
git remote set-url origin https://你的GitHub用户名:你的PAT令牌@github.com/lhq13152961500-beep/EIRCT-ICMP.git
```

绑定后直接执行推送即可：

```bash
git push origin main
```

#### 三、验证推送结果

1. 打开 GitHub 仓库页面，刷新后查看「Commits」记录，能看到你刚提交的修改说明；

2. 查看仓库文件列表，确认修改后的代码已同步。
```bash
git clone https://github.com/你的用户名/你的仓库名.git
cd 你的仓库名
npm install
```

### 第二步：创建免费数据库

推荐以下任意一个免费 PostgreSQL 云数据库：

| 服务 | 免费额度 | 注册地址 |
|------|----------|----------|
| **Neon** | 0.5 GB | https://neon.tech |
| **Supabase** | 500 MB | https://supabase.com |
| **Railway** | $5 额度/月 | https://railway.app |

注册后新建一个数据库，复制 **Connection String（连接字符串）**，格式如下：
```
postgresql://用户名:密码@主机:5432/数据库名
```

### 第三步：初始化数据库表

在你的数据库管理界面（如 Neon Console、Supabase SQL Editor）中，执行 `db/setup.sql` 文件中的所有 SQL 语句，这会创建 App 所需的全部数据表。

### 第四步：配置所有 API 密钥（必须全部配置）

本项目共需要 **5 类 API 密钥**，换账号后必须重新配置。在 Replit 中，所有密钥通过 **Secrets（环境变量）** 管理，不要写入代码文件。

---

#### 1. 数据库连接

| 变量名 | 说明 |
|--------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串，格式：`postgresql://用户名:密码@主机:5432/数据库名` |

第二步已获取，填入此处即可。

---

#### 2. 高德地图 API（地图 + 定位 + 天气）

前往 [高德开放平台控制台](https://console.amap.com/dev/key/app) 创建应用，添加三个 Key：

| 变量名 | 平台类型 | 用途 |
|--------|----------|------|
| `AMAP_API_KEY` | **Web端(JS API)** | 地图渲染、AR导览 |
| `AMAP_SERVER_KEY` | **Web服务** | 天气查询、路线规划 |
| `AMAP_SECURITY_KEY` | **安全密钥**（JS API 配套） | JS API 安全加固 |

> 申请步骤：控制台 → 我的应用 → 创建应用 → 添加 Key → 选择对应平台类型

---

#### 3. 豆包方舟 AI（小乡 AI 对话 + 语音伴游 LLM）

| 变量名 | 申请地址 | 说明 |
|--------|----------|------|
| `ARK_API_KEY` | https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey | 注册火山引擎后创建 API Key |

> 申请步骤：注册火山引擎 → 方舟控制台 → API Key 管理 → 创建 API Key → 复制密钥字符串

---

#### 4. Groq API（语音识别 Whisper）

语音输入功能（对着小乡说话）需要此密钥：

| 变量名 | 申请地址 | 说明 |
|--------|----------|------|
| `GROQ_API_KEY` | https://console.groq.com/keys | 完全免费，注册即可获取 |

> 申请步骤：注册 → API Keys → Create API Key → 复制以 `gsk_` 开头的字符串

---

#### 在 Replit 中配置 Secrets

1. 打开 Replit 项目，点击左侧工具栏的 **🔒 Secrets**（锁形图标）
2. 点击 **+ New Secret**
3. 逐一添加上述所有变量名和对应的值
4. 配置完成后，重启后端工作流（Stop → Run）

> 注意：Secrets 配置完毕后，前端扫码重新加载即可生效。无需修改任何代码文件。

---

### 第五步：启动项目

在 Replit 中，点击顶部 **Run** 按钮会自动启动后端。前端通过以下命令启动：

```bash
EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN python3 scripts/expo-start.py
```

用手机上的 **Expo Go** App 扫描终端中出现的 QR 码即可在手机上预览。

> 如扫码后无法加载，请重新扫码，不要点「Reload」按钮。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Expo / React Native / Expo Router |
| 后端 | Node.js / Express / TypeScript |
| 数据库 | PostgreSQL（Replit 内置 / Neon / Supabase） |
| 地图 | 高德地图 JS API v2 |
| AI 对话 | 豆包方舟 API（doubao-1-5-pro / vision） |
| 语音识别 | Groq Whisper API |
| 传感器 | expo-sensors（加速度计情感检测） |

## 项目结构

```
├── app/                    # Expo 页面（Expo Router）
│   ├── (tabs)/             # 底部导航页面
│   │   └── index.tsx       # 首页
│   ├── xiaoxiang-ai.tsx    # 小乡 AI 伴游页
│   ├── voice-guide-entry.tsx
│   └── _layout.tsx         # 根布局（含 ActivityProvider）
├── components/
│   └── XiaoxiangFace.tsx   # 小乡表情组件
├── contexts/
│   ├── ActivityContext.tsx  # 加速度计情感检测
│   ├── AuthContext.tsx
│   └── LocationContext.tsx
├── server/                 # Express 后端
│   ├── index.ts            # 服务入口（端口 5000）
│   ├── routes.ts           # API 路由
│   └── storage.ts          # 数据库操作
├── scripts/
│   └── expo-start.py       # Expo 启动脚本
├── db/
│   └── setup.sql           # 数据库初始化脚本
└── shared/
    └── schema.ts           # 数据类型定义
```

## 主要功能

- **首页**：景区发现、地图、活动推荐
- **小乡 AI**：基于豆包方舟 API 的旅游伴游助手，支持文字、语音、图片输入
- **情感检测**：加速度计实时感知游览状态（疲惫/平静/好奇/开心/愉快），AI 自动调整对话风格
- **语伴导游**：方言语音导览
- **AR 导览**：增强现实景点介绍
- **吐峪沟地图**：高德地图实景导览
