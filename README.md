# 旅行规划地图网站

基于 Vue 3 + Vite + 百度地图 JavaScript API + Express + MySQL 的旅行计划管理网站。用户可以创建多个旅行计划，在每个计划中保存地点、备注和计划前往时间，并创建多条具备名称、颜色与有序地点序列的路线；切换旅行计划时，地图只显示当前计划的数据。

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
- `routes`：路线头信息，保存所属计划、名称、颜色、显示顺序和乐观锁版本
- `route_stops`：路线中的有序地点，可在不相邻的位置重复经过同一地点
- 删除旅行计划时级联删除地点、路线和路线节点
- 路线引用地点时禁止直接删除，由应用在用户确认后事务性重连路线或删除不足两个地点的路线

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

路线创建与更新请求使用 `name`、`color`、`place_ids` 和 `order_index`；编辑时还需带上服务端返回的 `version`。接口会校验所有地点都属于当前旅行计划、路线至少包含两个地点，且不允许相邻地点相同；非相邻重复地点可用于表达折返。

## 第四步：前端 Vue 项目代码

前端主要文件：

- `frontend/src/App.vue`：登录页、Web/H5 布局、旅行计划、地点、搜索、路线和“去这里”交互
- `frontend/src/components/MapView.vue`：百度地图初始化、地点标点、彩色方向路线、序号气泡、InfoWindow、LocalSearch
- `frontend/src/services/api.js`：Axios API 封装
- `frontend/src/utils/navigation.js`：百度地图导航 URL 生成
- `frontend/vite.config.js`：读取 `../app.config.json`，在 `index.html` 注入百度地图 JS API

页面包含：

- 顶部计划切换和创建、编辑、删除
- 左侧旅行计划、地点列表、路线列表
- 中间百度地图
- 右侧地点搜索、地点编辑，以及路线的两步创建/编辑区
- 一条路线中的线段使用同一种颜色并带方向箭头；路线经过的标点上方显示同色圆形序号气泡
- 创建路线时按前往顺序点击已有地点，列表项会立即显示其序号；再次点击已选择地点时可选择“删除该地点”或“再次经过该地点”
- 路线支持命名、选色、调整地点顺序、删除节点、撤销和清空；同一计划可以创建多条路线
- 每条路线都可独立显示或隐藏，显示状态按旅行计划保存在当前设备的 `localStorage` 中
- 地点小标题会显示在地图 Marker 旁边，当前选中的地点会追加“当前”标记

### H5 使用方式

手机宽度下页面会切换为底部四栏导航：`主界面`、`路线`、`标点`、`我的`。主界面保留地图，并提供地点搜索、“显示小标题”和 `路线 X/Y` 筛选入口；筛选底部抽屉可单独控制每条路线，也可全部显示或全部隐藏。

- 搜索地点后会进入结果页，点击“添加”即可放入当前计划。
- 点击“地图选点”后，下一次点击地图才会打开新增标点表单；未开启该模式时普通地图点击不会新增数据。
- 路线页点击“创建路线”会进入全屏两步编辑器：第一步按顺序选择地点，第二步填写名称并设置颜色；编辑已有路线使用相同流程。
- 点击已选择地点时可删除该次经过，或再次经过该地点；同一地点出现多次时可以指定删除哪一次或删除全部出现位置。
- 关闭编辑器、切换计划或使用浏览器返回键时，如果存在未保存修改，会提示是否放弃。
- 标点页和标点详情都提供“去这里”，以浏览器当前位置为起点、目标标点为终点打开百度地图，固定使用驾车模式；路线本身不再提供导航入口。
- “我的”页可切换、新建、编辑和删除旅行计划。

### 已有数据库升级

升级前必须先备份数据库。然后对每个已部署数据库运行一次：

```bash
cd backend
pnpm run init-db
```

初始化程序会按原有 `order_index` 将每个计划中的旧线段整理为一条名为“计划路线”的有序路线，并创建对应的 `route_stops`。旧线段不连续时会补入下一段起点，使前后两段自动连接并保留原有折返；迁移可重复执行，不会重复生成路线或节点。不能跳过备份或直接手工删除迁移标记。

如果服务器只部署了打包后的 `server.js`，没有 Node.js 项目脚本，可将 `backend/database/migrate-multi-route-v2.sql` 单独上传到服务器，并在停止后端、完成数据库备份后执行：

```bash
mysql -h 数据库地址 -P 3306 -u 数据库用户 -p --database=实际数据库名 \
  < migrate-multi-route-v2.sql
```

不要为该命令添加 `--force`。SQL 脚本会检查地点归属和相邻重复地点；旧线段不连续时，会按原有排序补入下一段起点，使前后两段自动连接。检查失败时会在修改 `routes` 表前停止。迁移成功后可安全地重复执行，脚本会根据迁移标记跳过已经完成的数据转换。

删除仍被路线引用的地点时，界面会先列出影响：中间节点被删后，其相邻地点自动连线；路线仅剩两个地点或清理后不足两个地点时，整条路线会被删除。只有用户确认“仍然删除”后才会在一个事务中执行。

地图坐标统一按百度 BD-09 经纬度保存。

## 第五步：后端配置与环境模式

后端按运行模式读取环境文件：development 优先读取 `backend/.env.development`，production 优先读取 `backend/.env.production`；对应文件不存在时均回退到 `backend/.env`。本地开发可先复制示例文件：

```bash
cd backend
cp .env.development.example .env.development
```

Windows PowerShell 可使用：

```powershell
Copy-Item .env.development.example .env.development
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

后端配置示例分别见 `backend/.env.development.example` 与 `backend/.env.production.example`；`backend/.env.example` 保留为通用回退模板。真实环境文件不会提交到 Git。

## 第六步：项目运行方式

先安装依赖：

```bash
cd backend
pnpm install

cd ../frontend
pnpm install
```

初始化数据库（已有数据库请先备份）：

```bash
cd backend
pnpm run init-db
```

以 development 模式启动后端：

```bash
cd backend
pnpm run start
```

需要热重载时使用 `pnpm run dev`。需要在本机以 production 配置运行源码服务时使用：

```bash
pnpm run prod
```

构建并部署后端：

```bash
cd backend
pnpm run build

# 上传 dist/server.js，并在同一目录放置 .env.production；也可只放置 .env 作为回退
node server.js
```

构建过程只写入 production 模式标记，不会把数据库密码等环境变量编译进 `server.js`，也不会自动复制真实环境文件。

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
- 用百度道路规划绘制真实道路路径，而不是直线 Polyline
- 地点分类、预算、门票、开放时间字段
- 行程日历视图和每日路线分组
- 导入导出 JSON、Excel 或分享链接
- 地点照片、附件和协同编辑
- 根据时间、停留时长自动优化路线
