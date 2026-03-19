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

### 第四步：配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的配置：

```env
DATABASE_URL=postgresql://...  # 第二步获取的连接字符串

AMAP_API_KEY=...               # 高德地图 Web JS API Key
AMAP_SERVER_KEY=...            # 高德地图 Web 服务 API Key
AMAP_SECURITY_KEY=...          # 高德地图安全密钥（可选）
```

> **申请高德地图 Key：** https://console.amap.com/dev/key/app
> - `AMAP_API_KEY`：平台选 **Web端(JS API)**
> - `AMAP_SERVER_KEY`：平台选 **Web服务**

### 第五步：启动项目

```bash
# 启动后端（端口 5000）
npm run server:dev

# 新开一个终端，启动前端
npm run expo:dev
```

用 **Expo Go** App 扫描终端中出现的 QR 码即可在手机上预览。

---

## 技术栈

- **前端**：Expo / React Native / Expo Router
- **后端**：Node.js / Express / TypeScript
- **数据库**：PostgreSQL
- **地图**：高德地图 API

## 项目结构

```
├── app/            # Expo 页面（Expo Router）
├── components/     # 公共 UI 组件
├── server/         # Express 后端
│   ├── index.ts    # 服务入口
│   ├── routes.ts   # API 路由
│   └── storage.ts  # 数据库操作
├── db/
│   └── setup.sql   # 数据库初始化脚本
├── shared/
│   └── schema.ts   # 数据类型定义
└── .env.example    # 环境变量示例
```
