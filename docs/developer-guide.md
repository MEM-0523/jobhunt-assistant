# 开发者指南

## 一、技术架构

```
┌─────────────────────────────────────────────────┐
│                    用户浏览器                      │
│              React 19 + TypeScript               │
│         Vite + Tailwind CSS + Zustand            │
└────────────────────┬────────────────────────────┘
                     │ HTTP/REST (JSON)
                     │ JWT Bearer Token
┌────────────────────▼────────────────────────────┐
│               FastAPI 后端服务                     │
│         Python 3.x + SQLAlchemy ORM              │
│              SQLite 数据库 (本地)                   │
└────────────────────┬────────────────────────────┘
                     │ 子进程调用
┌────────────────────▼────────────────────────────┐
│              外部服务（可选）                       │
│   • autocli search-jobs (命令行搜索岗位)           │
│   • lark-cli bitable (飞书反馈同步)               │
│   • AI API (GPT-4o-mini, 未来)                   │
└─────────────────────────────────────────────────┘
```

### 技术选型

| 层 | 技术 | 说明 |
|---|------|------|
| 前端框架 | React 19 | 最新稳定版 |
| 类型系统 | TypeScript 6.0 | 全量类型覆盖 |
| 构建工具 | Vite 8.0 | 极速HMR |
| CSS框架 | Tailwind CSS 3.4 | 原子化CSS |
| 状态管理 | Zustand 5.0 | 轻量级 |
| 路由 | React Router 7.15 | SPA路由 |
| 图表 | Recharts 3.8 | 漏斗图/统计图 |
| 图标 | Lucide React | SVG图标库 |
| HTTP客户端 | Axios | 请求拦截器支持JWT |
| 后端框架 | FastAPI 0.115 | 异步Python Web |
| ORM | SQLAlchemy 2.0 | 数据库抽象 |
| 数据库 | SQLite | 零配置本地数据库 |
| 认证 | python-jose (JWT) | 无状态Token认证 |
| 密码加密 | passlib + bcrypt | 安全哈希 |
| 部署 | Pinme Platform | Pages + API |

---

## 二、项目结构

```
12-求职助手Web/
├── frontend/                    # React 前端
│   ├── public/
│   │   ├── favicon.svg
│   │   └── icons.svg
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts        # Axios 实例 + JWT 拦截器
│   │   ├── assets/
│   │   │   └── hero.png
│   │   ├── components/
│   │   │   ├── JobCard.tsx      # 岗位卡片组件
│   │   │   ├── Layout.tsx       # 页面布局（导航+内容区）
│   │   │   ├── Navbar.tsx       # 顶部导航栏
│   │   │   └── ProtectedRoute.tsx  # 登录保护路由
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx    # 工作台/首页
│   │   │   ├── Search.tsx       # 岗位搜索页
│   │   │   ├── JobDetail.tsx    # 岗位详情 + JD分析
│   │   │   ├── Resume.tsx       # 简历管理页
│   │   │   ├── ApplicationTracking.tsx  # 投递追踪页
│   │   │   ├── InterviewPrep.tsx  # 面试准备页
│   │   │   ├── Login.tsx        # 登录页
│   │   │   ├── Register.tsx     # 注册页
│   │   │   └── Settings.tsx     # 个人设置页
│   │   ├── stores/
│   │   │   └── authStore.ts     # Zustand 认证状态
│   │   ├── types/
│   │   │   └── index.ts         # 全部 TypeScript 类型定义
│   │   ├── App.tsx              # 路由配置
│   │   ├── main.tsx             # 入口文件
│   │   └── index.css            # 全局样式 + Tailwind 指令
│   ├── .env.example             # 环境变量模板
│   ├── index.html               # HTML 入口
│   ├── package.json             # 依赖配置
│   ├── vite.config.ts           # Vite 配置
│   ├── tailwind.config.js       # Tailwind 配置
│   ├── tsconfig.json            # TypeScript 配置
│   └── wrangler.toml            # Pinme Pages 部署配置
│
├── backend/                     # FastAPI 后端
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py             # 注册/登录/用户信息
│   │   ├── profile.py          # 个人画像 CRUD
│   │   ├── jobs.py             # 岗位搜索/详情/JD分析
│   │   ├── resumes.py          # 简历上传/列表/优化
│   │   ├── applications.py     # 投递追踪/状态流转/统计
│   │   ├── interviews.py       # 面试方案生成/列表
│   │   └── feedback.py         # 用户反馈
│   ├── auth.py                 # JWT 工具函数 + 认证依赖
│   ├── database.py             # 数据库连接 + Session 管理
│   ├── models.py               # SQLAlchemy 数据模型 (6张表)
│   ├── main.py                 # FastAPI 入口 + 路由注册
│   ├── requirements.txt        # Python 依赖
│   └── wrangler.toml           # Pinme API 部署配置
│
├── docs/                        # 文档
│   ├── business-plan.md        # 商业化可行性分析
│   ├── user-guide.md           # 用户使用指南
│   └── developer-guide.md      # 开发者指南（本文件）
│
├── README.md                    # 项目 README
└── deploy.sh                    # 一键部署脚本
```

---

## 三、本地开发

### 环境要求

- Node.js 18+
- Python 3.10+
- npm 或 pnpm

### 前端开发

```bash
cd frontend
npm install
npm run dev
```

开发服务器运行在 `http://localhost:5173`，支持 HMR 热更新。

### 后端开发

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API 运行在 `http://localhost:8000`，自动生成 Swagger 文档在 `http://localhost:8000/docs`。

### 环境变量

**前端** `.env`：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_API_URL` | 后端 API 地址 | `http://localhost:8000` |

**后端** `.env`：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `JWT_SECRET_KEY` | JWT 签名密钥 | 开发默认值（生产环境务必修改） |
| `AI_API_KEY` | AI 服务 API 密钥 | 空（使用内置模拟分析） |
| `FEISHU_APP_TOKEN` | 飞书应用 Token | 空 |

### 数据库

- 使用 SQLite，数据库文件 `backend/job_assistant.db`，首次启动自动创建
- 表结构由 `models.py` 定义，启动时通过 `lifespan` 自动 `create_all`
- 无需手动执行迁移

---

## 四、API 接口文档

### 认证模块

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth/register` | 注册新用户（email + password） | 否 |
| POST | `/api/auth/login` | 登录（返回 JWT token） | 否 |
| GET | `/api/auth/me` | 获取当前用户信息 | 是 |

### 个人画像

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/profile` | 获取当前用户画像 | 是 |
| PUT | `/api/profile` | 更新画像（部分字段） | 是 |

### 岗位搜索

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/jobs/search` | 搜索岗位（keyword/city/platform） | 是 |
| GET | `/api/jobs/` | 列出已保存的岗位 | 是 |
| GET | `/api/jobs/{job_id}` | 获取岗位详情 | 是 |
| GET | `/api/jobs/{job_id}/analyze` | JD智能分析（10维度评分） | 是 |

### 简历管理

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/resumes/upload` | 上传简历（multipart .md 文件） | 是 |
| GET | `/api/resumes/` | 列出所有简历版本 | 是 |
| POST | `/api/resumes/{resume_id}/optimize` | AI简历优化（需传 job_id） | 是 |

### 投递追踪

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/applications` | 列出投递记录（支持status筛选） | 是 |
| POST | `/api/applications` | 创建投递记录 | 是 |
| PUT | `/api/applications/{app_id}` | 更新投递状态/备注 | 是 |
| DELETE | `/api/applications/{app_id}` | 删除投递记录 | 是 |
| GET | `/api/applications/stats` | 投递统计（漏斗/分类/周变化） | 是 |

### 面试准备

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/interviews/generate` | 生成面试方案（传 application_id） | 是 |
| GET | `/api/interviews/` | 列出所有面试准备记录 | 是 |

### 用户反馈

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/feedback` | 提交反馈（type + content） | 是 |
| GET | `/api/feedback` | 列出用户反馈 | 是 |

### 系统

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/health` | 健康检查 | 否 |

---

## 五、数据模型

### users（用户表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键，自增 |
| email | String | 邮箱，唯一索引 |
| password_hash | String | bcrypt 哈希密码 |
| created_at | DateTime | 创建时间 |

### profiles（个人画像表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| user_id | Integer | 外键 → users.id，一对一 |
| name | String | 姓名 |
| phone | String | 手机号 |
| city | String | 城市 |
| salary_min | Integer | 最低薪资（K） |
| salary_max | Integer | 最高薪资（K） |
| deal_breakers | JSON | 不能接受的条件列表 |
| preferences | JSON | 偏好设置字典 |

### jobs（岗位表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| user_id | Integer | 外键 → users.id |
| title | String | 岗位名称 |
| company | String | 公司名称 |
| salary | String | 薪资范围（如"25-40K"） |
| city | String | 城市 |
| platform | String | 招聘平台 |
| jd_text | Text | 岗位描述全文 |
| match_score | Float | 匹配评分 |
| rating | Integer | 评分等级 |
| status | String | 状态（new/applied/interview/offer/rejected/saved） |
| jd_url | String | 岗位链接 |

### applications（投递表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| user_id | Integer | 外键 → users.id |
| job_id | Integer | 外键 → jobs.id |
| status | String | 投递状态（12种状态流转） |
| applied_at | DateTime | 投递时间 |
| notes | Text | 备注 |

### resumes（简历表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| user_id | Integer | 外键 → users.id |
| content | Text | 简历内容（Markdown） |
| version | Integer | 版本号（自增） |
| created_at | DateTime | 创建时间 |

### interview_preps（面试准备表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| user_id | Integer | 外键 → users.id |
| job_id | Integer | 外键 → jobs.id |
| content | JSON | 面试方案内容 |
| created_at | DateTime | 创建时间 |

### feedbacks（反馈表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| user_id | Integer | 外键 → users.id |
| type | String | 反馈类型 |
| content | Text | 反馈内容 |
| created_at | DateTime | 创建时间 |

---

## 六、部署流程

### Pinme 一键部署

```bash
chmod +x deploy.sh
./deploy.sh
```

### 手动分别部署

```bash
# 前端部署（Pinme Pages）
cd frontend
npm run build
npx pinme save

# 后端部署（Pinme API）
cd ../backend
npx pinme save
```

### 生产环境配置

1. 修改后端 `JWT_SECRET_KEY` 为强随机字符串
2. 配置 `AI_API_KEY`（如需真实AI分析）
3. 在 `backend/main.py` 中更新 `allow_origins` 为生产域名
4. 确认 Pinme 平台的环境变量已配置

---

## 七、扩展指南

### 添加新页面（前端）

1. 在 `frontend/src/pages/` 下新建页面组件，如 `NewFeature.tsx`
2. 在 `App.tsx` 中添加路由：
   ```tsx
   <Route path="/new-feature" element={<ProtectedRoute><NewFeature /></ProtectedRoute>} />
   ```
3. 在 `Navbar.tsx` 中添加导航链接
4. 如需新类型，在 `types/index.ts` 中添加接口定义

### 添加新API端点（后端）

1. 在 `backend/routers/` 下新建路由文件（或添加到已有文件）
2. 在 `backend/models.py` 中添加新数据模型（如需新表）
3. 在 `backend/main.py` 中注册路由：
   ```python
   from routers import new_feature
   app.include_router(new_feature.router, prefix="/api")
   ```
4. 重启后端服务使改动生效

### 接入真实AI服务

当前JD分析和简历优化使用内置模拟数据。接入真实AI的步骤：

1. 在环境变量中配置 `AI_API_KEY`
2. 在 jobs.py 的 `analyze_job` 和 resumes.py 的 `optimize_resume` 中，将模拟逻辑替换为 AI API 调用
3. 使用 `httpx`（已安装）发送请求到 OpenAI 兼容接口
4. 解析 AI 返回的 JSON 结构化内容

### 接入真实岗位数据

当前搜索使用内置模拟数据 + autocli 子进程。接入真实API的步骤：

1. 在 `jobs.py` 的 `try_autocli_search` 基础上，添加真实招聘平台的 API 调用
2. 实现统一的搜索接口适配层，支持多平台聚合
3. 添加搜索结果缓存，减少 API 调用次数

### 添加付费系统

1. 在 `models.py` 添加订阅表（subscriptions）
2. 创建新的支付路由 `routers/payments.py`
3. 在认证中间件中添加权限检查（免费版/Pro版功能限制）
4. 前端根据用户订阅状态显示/隐藏功能入口

---

## 八、认证流程

```
1. 用户注册/登录 → 后端返回 JWT Token
2. 前端将 Token 存入 localStorage
3. Axios 拦截器自动在请求头添加 Authorization: Bearer <token>
4. 后端 get_current_user 依赖解析 Token，获取当前用户
5. 401 响应时，Axios 拦截器自动清除 Token 并跳转登录页
```

JWT Token 使用 `python-jose` 库生成，密钥配置在 `JWT_SECRET_KEY` 环境变量中。

---

## 九、投递状态流转规则

```python
STATUS_FLOW = {
    "待投递": ["已投递"],
    "已投递": ["初筛通过", "初筛拒绝", "面试邀约", "无回应"],
    "初筛通过": ["面试邀约"],
    "面试邀约": ["面试中", "无回应"],
    "面试中": ["面试通过", "面试拒绝"],
    "面试通过": ["offer"],
    "offer": ["接受", "拒绝"],
}
```

漏斗阶段（用于统计）：待投递 → 已投递 → 面试邀约 → 面试中 → offer