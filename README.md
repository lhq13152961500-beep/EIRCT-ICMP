# 乡音伴旅 (Xiangyin Banlv)

一款记录和分享地方声音与方言的文化旅行社交 App，基于 Expo (React Native) + Express + PostgreSQL 构建。

---

## 快速上手（本地部署）

### 第一步：克隆项目

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
