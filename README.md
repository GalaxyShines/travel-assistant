# 旅行规划地图网站

基于 Vue 3 + Vite + 百度地图 JavaScript API + Express + MySQL 的旅行计划管理网站。用户可以创建多个旅行计划，在每个计划中保存地点、备注、计划前往时间，并手动创建地点之间的路线连线；切换旅行计划时，地图只显示当前计划的数据。

## 第一步：项目目录结构

```text
travel-helper/
├─ app.config.json                 # 前端开发构建配置（后端不读取）
├─ README.md
├─ .gitignore
├─ backend/
│  ├─ package.json
│  ├─ .env.example
│  ├─ database/
│  │  └─ schema.sql                # MySQL 建库建表 SQL
│  ├─ data/
│  │  └─ auth-session.json         # 运行时生成，保存当前唯一有效 token 的哈希
│  ├─ scripts/
│  │  └─ init-db.js                # 根据 backend/.env 初始化数据库
│  └─ src/
│     ├─ app.js                    # Express 应用入口
│     ├─ server.js                 # 服务启动与数据库连通检查
│     ├─ config.js                 # 读取部署目录中的 .env
│     ├─ db.js                     # mysql2 连接池
│     ├─ middleware/
│     │  ├─ authRequired.js
│     │  └─ errorHandler.js
│     ├─ routes/
│     │  ├─ auth.js                # 登录签发 token
│     │  ├─ trips.js               # 旅行计划接口
│     │  ├─ places.js              # 地点接口
│     │  └─ routes.js              # 路线接口
│     └─ utils/
│        ├─ asyncHandler.js
│        ├─ httpError.js
│        └─ normalizers.js
└─ frontend/
   ├─ package.json
   ├─ index.html
   ├─ vite.config.js               # 注入百度地图 JS API
   └─ src/
      ├─ App.vue
      ├─ main.js
      ├─ styles.css
      ├─ config.js
      ├─ components/
      │  └─ MapView.vue
      ├─ services/
      │  └─ api.js
      └─ utils/
         ├─ mapLoader.js
         └─ navigation.js
```

## 第二步：MySQL 建表 SQL

SQL 文件在 `backend/database/schema.sql`，包含：

- `CREATE DATABASE IF NOT EXISTS travel_helper`
- `trips`：旅行计划
- `places`：地点，`trip_id` 外键关联 `trips.id`，并包含 `subtitle` 小标题字段，最多 15 字
- `routes`：路线连线，`trip_id`、`from_place_id`、`to_place_id` 分别关联旅行计划和地点
- 删除旅行计划时级联删除地点和路线
- 删除地点时级联删除相关路线

## 第三步：后端 Express 项目代码

后端入口：

- `backend/src/server.js`：启动服务并检查数据库连接
- `backend/src/app.js`：注册 CORS、JSON 中间件、路由和错误处理
- `backend/src/db.js`：创建 `mysql2/promise` 连接池
- `backend/src/routes/*.js`：拆分 RESTful API

已实现接口：

```text
POST   /api/auth/login
GET    /api/auth/session

GET    /api/trips
POST   /api/trips
PUT    /api/trips/:id
DELETE /api/trips/:id

GET    /api/trips/:tripId/places
POST   /api/trips/:tripId/places
PUT    /api/places/:id
DELETE /api/places/:id

GET    /api/trips/:tripId/routes
POST   /api/trips/:tripId/routes
PUT    /api/routes/:id
DELETE /api/routes/:id

GET    /api/health
GET    /api/config/public
```

除 `health`、`config/public` 和 `auth/login` 外，业务接口都需要携带：

```text
Authorization: Bearer <token>
```

登录口令为 `Qwerty@123!`。每次登录都会覆盖 `backend/data/auth-session.json` 中的当前会话，因此其他浏览器或标签页旧 token 会立即失效。

路线接口会校验起点和终点都属于当前旅行计划，避免跨计划连线。

## 第四步：前端 Vue 项目代码

前端主要文件：

- `frontend/src/App.vue`：登录页、页面布局、旅行计划、地点、搜索、连线、导航交互
- `frontend/src/components/MapView.vue`：百度地图初始化、Marker、Polyline、InfoWindow、LocalSearch
- `frontend/src/services/api.js`：Axios API 封装
- `frontend/src/utils/navigation.js`：百度地图导航 URL 生成
- `frontend/vite.config.js`：读取 `../app.config.json`，在 `index.html` 注入百度地图 JS API

页面包含：

- 顶部计划切换和创建、编辑、删除
- 左侧旅行计划、地点列表、路线列表
- 中间百度地图
- 右侧地点搜索、地点编辑、路线创建
- 地点小标题会显示在地图 Marker 旁边，当前选中的地点会追加“当前”标记

### H5 使用方式

手机宽度下页面会切换为底部四栏导航：`主界面`、`路线`、`标点`、`我的`。主界面保留地图，并提供地点搜索、“显示小标题”和“显示路线”开关；两项显示偏好会保存到本机 `localStorage`。

- 搜索地点后会进入结果页，点击“添加”即可放入当前计划。
- 点击“地图选点”后，下一次点击地图才会打开新增标点表单；未开启该模式时普通地图点击不会新增数据。
- 点击“选点连线”后依次选择起点和终点标点，再确认交通方式和排序即可创建路线。同一计划中相同方向的路线只允许一条，重复时会提示“路线已存在”。
- 路线和标点页可继续编辑、删除或打开百度导航；“我的”页可切换、新建、编辑和删除旅行计划。

首次升级已有数据库后，请运行一次 `cd backend && pnpm run init-db`，以创建路线唯一索引。如果该命令报告已有重复路线，请先手动清理重复数据再重试。

地图坐标统一按百度 BD-09 经纬度保存。

## 第五步：后端配置与 .env 示例

后端服务的全部配置均从 `backend/.env` 读取。请先复制示例文件：

```bash
cd backend
cp .env.example .env
```

Windows PowerShell 可使用：

```powershell
Copy-Item .env.example .env
```

可配置项包括：`APP_NAME`、`BACKEND_PORT`、`CORS_ORIGIN`、`BAIDU_MAP_AK`、`DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`、`AUTH_PASSWORD` 和 `AUTH_SESSION_FILE`。`AUTH_SESSION_FILE` 为相对路径时，会相对于部署目录中的 `server.js` 解析。

根目录的 `app.config.json` 仍由前端开发构建使用；后端启动和打包不再读取它。

下面的内容仅供前端开发配置参考：

```json
{
  "appName": "旅行规划地图",
  "frontend": {
    "port": 5173,
    "apiBaseUrl": "http://localhost:3000/api"
  },
  "backend": {
    "port": 3000,
    "corsOrigin": "http://localhost:5173"
  },
  "database": {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "ydk20051203",
    "name": "travel_helper"
  },
  "auth": {
    "password": "Qwerty@123!",
    "sessionFile": "backend/data/auth-session.json"
  },
  "baiduMap": {
    "ak": ""
  }
}
```

开发完成后，把百度地图 AK 填入：

```json
"baiduMap": {
  "ak": "你的百度地图AK"
}
```

后端 `.env` 的完整示例见 `backend/.env.example`。

## 第六步：项目运行方式

先安装依赖：

```bash
cd backend
pnpm install

cd ../frontend
pnpm install
```

初始化数据库：

```bash
cd backend
pnpm run init-db
```

启动后端：

```bash
cd backend
pnpm run dev
```

构建并部署后端（服务器只需 `server.js` 和 `.env`）：

```bash
cd backend
pnpm run build

# 上传 dist/server.js 与按 .env.example 配置好的 .env 到同一目录
node server.js
```

启动前端：

```bash
cd frontend
pnpm run dev
```

默认地址：

- 前端：http://localhost:5173
- 后端：http://localhost:3000/api
- 数据库：localhost:3306 / root / ydk20051203 / travel_helper

## 第七步：后续可以优化的功能

- 用户登录和多用户旅行计划隔离
- 地点拖拽排序和路线拖拽排序
- 用百度驾车、步行、公交路线规划绘制真实道路路径，而不是直线 Polyline
- 地点分类、预算、门票、开放时间字段
- 行程日历视图和每日路线分组
- 导入导出 JSON、Excel 或分享链接
- 地点照片、附件和协同编辑
- 根据时间、停留时长和交通方式自动优化路线
