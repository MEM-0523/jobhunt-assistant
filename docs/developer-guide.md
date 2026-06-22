# 开发者指南

> 版本：v2.0 | 日期：2026-06-22 | 状态：本地运行

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
│         Python 3.9 + SQLAlchemy ORM              │
│              SQLite 数据库 (本地)                   │
└────────────────────┬────────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
┌─────────┐  ┌──────────────┐  ┌──────────┐
│ 猎聘MCP  │  │Playwright爬虫 │  │ 国际API  │
│  API    │  │BOSS直聘/51job │  │Himalayas │
│         │  │              │  │Remotive  │
└─────────┘  └──────────────┘  └──────────┘
                     │
                     ▼
            ┌──────────────┐
            │  Pinme AI    │
            │  (gpt-4o-mini)│
            └──────────────┘
```

### 技术选型

| 层 | 技术 | 说明 |
|---|------|------|
| 前端框架 | React 19 | 最新稳定版 |
| 类型系统 | TypeScript | 全量类型覆盖 |
| 构建工具 | Vite | 极速HMR |
| CSS框架 | Tailwind CSS 3.4 | 原子化CSS |
| 状态管理 | Zustand | 轻量级 |
| 路由 | React Router 7 | SPA路由 |
| 图表 | Recharts | 漏斗图/统计图 |
| 图标 | Lucide React | SVG图标库 |
| HTTP客户端 | Axios | 请求拦截器支持JWT |
| 后端框架 | FastAPI 0.115 | 异步Python Web |
| ORM | SQLAlchemy 2.0 | 数据库抽象 |
| 数据库 | SQLite | 零配置本地数据库 |
| 认证 | python-jose (JWT) | 无状态Token认证 |
| 密码加密 | passlib + bcrypt | 安全哈希 |
| AI | Pinme API (gpt-4o-mini) | JD分析/简历优化/面试方案 |
| 爬虫 | Playwright | BOSS直聘/前程无忧反检测 |
| 部署 | 本地运行 | 云端部署暂停 |

---

## 二、项目结构

```
12-求职助手Web/
├── frontend/                    # React 前端
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts        # Axios 实例 + JWT 拦截器
│   │   ├── components/
│   │   │   ├── JobCard.tsx      # 岗位卡片组件
│   │   │   ├── Layout.tsx       # 页面布局（侧边栏+内容区）
│   │   │   ├── Navbar.tsx       # 顶部导航栏
│   │   │   ├── PageSkeleton.tsx # 全局加载骨架屏
│   │   │   ├── ProtectedRoute.tsx  # 登录保护路由
│   │   │   ├── NotificationBell.tsx  # 通知铃铛
│   │   │   └── FiveDimensionScore.tsx  # 五维度评分雷达图
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx    # 工作台/数据看板
│   │   │   ├── Search.tsx       # 岗位搜索（5平台聚合）
│   │   │   ├── JobDetail.tsx    # 岗位详情 + JD分析
│   │   │   ├── JDDirectAnalyze.tsx  # JD直推分析（粘贴JD文本）
│   │   │   ├── Resume.tsx       # 简历管理 + AI优化
│   │   │   ├── Applications.tsx # 投递追踪 + 漏斗分析
│   │   │   ├── InterviewPrep.tsx  # 面试准备（AI全案生成）
│   │   │   ├── InterviewPractice.tsx  # AI模拟面试训练
│   │   │   ├── CareerAssessment.tsx   # 职业测评（霍兰德+大五人格）
│   │   │   ├── CareerTransition.tsx   # 能力迁移路径分析
│   │   │   ├── ExperienceAssets.tsx   # 经历资产管理
│   │   │   ├── StrengthAnalysis.tsx   # 优势分析诊断
│   │   │   ├── Favorites.tsx    # 岗位收藏
│   │   │   ├── PlatformAuth.tsx # 平台授权管理
│   │   │   ├── Login.tsx        # 登录页
│   │   │   ├── Register.tsx     # 注册页
│   │   │   └── Settings.tsx     # 个人设置
│   │   ├── stores/
│   │   │   └── authStore.ts     # Zustand 认证状态
│   │   ├── types/
│   │   │   └── index.ts         # TypeScript 类型定义
│   │   ├── utils/
│   │   │   └── assessment.ts    # 测评工具函数
│   │   ├── data/
│   │   │   └── transitionCases.ts  # 转型案例数据
│   │   ├── App.tsx              # 路由配置 + Suspense
│   │   ├── main.tsx             # 入口文件
│   │   └── index.css            # 全局样式 + Tailwind 指令
│   ├── index.html               # HTML 入口
│   ├── package.json             # 依赖配置
│   ├── vite.config.ts           # Vite 配置
│   ├── tailwind.config.js       # Tailwind 配置
│   └── tsconfig.json            # TypeScript 配置
│
├── backend/                     # FastAPI 后端
│   ├── routers/
│   │   ├── auth.py             # 注册/登录/用户信息
│   │   ├── profile.py          # 个人画像 CRUD
│   │   ├── jobs.py             # 岗位搜索/详情/分析/收藏/统计
│   │   ├── resumes.py          # 简历上传/列表/优化
│   │   ├── applications.py     # 投递追踪/状态流转/统计
│   │   ├── interviews.py       # 面试方案生成/模拟训练
│   │   ├── career.py           # 职业测评/转型路径
│   │   ├── experiences.py      # 经历资产管理
│   │   ├── strengths.py        # 优势分析
│   │   ├── feedback.py         # 用户反馈
│   │   ├── notifications.py    # 通知管理
│   │   ├── platform_auth.py    # 招聘平台授权
│   │   └── seed.py             # 种子数据
│   ├── utils/
│   │   └── file_parser.py      # 文件解析（PDF/Word）
│   ├── ai_client.py            # AI API 客户端
│   ├── auth.py                 # JWT 工具函数 + 认证依赖
│   ├── database.py             # 数据库连接 + Session 管理
│   ├── job_sources.py          # 国际岗位数据源（Himalayas/Remotive）
│   ├── liepin_mcp_client.py    # 猎聘MCP API客户端
│   ├── models.py               # SQLAlchemy 数据模型（14张表）
│   ├── playwright_crawler.py   # Playwright爬虫核心
│   ├── main.py                 # FastAPI 入口 + 路由注册
│   ├── requirements.txt        # Python 依赖
│   └── .env                    # 环境变量
│
├── docs/                        # 文档
│   ├── archive/                 # 历史文档归档
│   ├── business-plan.md        # 商业化可行性分析
│   ├── user-guide.md           # 用户使用指南
│   ├── developer-guide.md      # 开发者指南（本文件）
│   ├── 项目规划-v1.0.md        # 项目规划
│   └── 部署指南-v1.0.md        # 部署指南
│
├── README.md                    # 项目 README
├── FEATURE_MATRIX.md            # 功能矩阵
├── PRODUCT_POSITIONING.md       # 产品定位
└── Dockerfile                   # Docker 配置
```

---

## 三、本地开发

### 环境要求

- Node.js 18+
- Python 3.9+
- npm 或 pnpm
- Playwright（用于BOSS直聘/前程无忧爬虫）

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
playwright install chromium  # 安装Playwright浏览器
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API 运行在 `http://localhost:8000`，自动生成 Swagger 文档在 `http://localhost:8000/docs`。

### 环境变量

**后端** `.env`：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `JWT_SECRET_KEY` | JWT 签名密钥 | 开发默认值（生产环境务必修改） |
| `PINME_API_KEY` | Pinme AI API 密钥 | 必填 |
| `PINME_API_BASE` | Pinme API 地址 | `https://api.pinme.dev/v1` |
| `CORS_ALLOW_ORIGINS` | CORS 允许域名 | 本地开发默认值 |

### 数据库

- 使用 SQLite，数据库文件 `backend/job_assistant.db`，首次启动自动创建
- 表结构由 `models.py` 定义，启动时通过 `lifespan` 自动 `create_all`
- 共 14 张表：users, profiles, jobs, job_favorites, job_cache, applications, resumes, interview_preps, interview_reviews, interview_practice_sessions, feedbacks, notifications, experiences, strengths, platform_auths

---

## 四、API 接口文档

### 认证模块

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth/register` | 注册新用户 | 否 |
| POST | `/api/auth/login` | 登录（返回JWT token） | 否 |
| GET | `/api/auth/me` | 获取当前用户信息 | 是 |

### 个人画像

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/profile` | 获取当前用户画像 | 是 |
| PUT | `/api/profile` | 更新画像 | 是 |

### 岗位搜索（5平台聚合）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/jobs/search` | 搜索岗位（keyword/city/platform） | 是 |
| GET | `/api/jobs/` | 列出已保存岗位 | 是 |
| GET | `/api/jobs/{job_id}` | 获取岗位详情 | 是 |
| GET | `/api/jobs/{job_id}/analyze` | JD智能分析 | 是 |
| POST | `/api/jobs/{job_id}/favorite` | 收藏/取消收藏 | 是 |
| GET | `/api/jobs/favorites` | 收藏列表 | 是 |
| POST | `/api/jobs/save-from-analysis` | 从分析结果保存岗位 | 是 |
| POST | `/api/jobs/direct-analyze` | JD直推分析（粘贴JD文本） | 是 |
| GET | `/api/jobs/international` | 国际岗位搜索（Himalayas/Remotive） | 是 |
| GET | `/api/jobs/heatmap` | 投递热力图数据 | 是 |
| GET | `/api/jobs/weekly-report` | 周报数据 | 是 |
| GET | `/api/jobs/data-sources` | 数据源统计 | 是 |

### 平台授权

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/platform-auth/status` | 获取各平台授权状态 | 是 |
| POST | `/api/platform-auth/connect` | 连接平台（BOSS/猎聘/51job） | 是 |
| POST | `/api/platform-auth/disconnect` | 断开平台连接 | 是 |

### 简历管理

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/resumes/upload` | 上传简历（支持PDF/Word/Markdown） | 是 |
| GET | `/api/resumes/` | 列出所有简历版本 | 是 |
| POST | `/api/resumes/{resume_id}/optimize` | AI简历优化（6阶段Pipeline） | 是 |

### 投递追踪

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/applications` | 列出投递记录 | 是 |
| POST | `/api/applications` | 创建投递记录 | 是 |
| PUT | `/api/applications/{app_id}` | 更新投递状态/备注 | 是 |
| DELETE | `/api/applications/{app_id}` | 删除投递记录 | 是 |
| GET | `/api/applications/stats` | 投递统计（漏斗/分类/周变化） | 是 |

### 面试准备

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/interviews/generate` | 生成面试方案 | 是 |
| GET | `/api/interviews/` | 列出面试准备记录 | 是 |
| POST | `/api/interviews/practice/start` | 开始模拟面试 | 是 |
| POST | `/api/interviews/practice/answer` | 提交回答 | 是 |
| POST | `/api/interviews/practice/end` | 结束模拟面试 | 是 |

### 职业测评与转型

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/career/assessment/submit` | 提交测评结果 | 是 |
| GET | `/api/career/assessment/result` | 获取测评结果 | 是 |
| POST | `/api/career/transition/analyze` | 转型路径分析 | 是 |
| GET | `/api/career/transition/cases` | 转型案例库 | 是 |

### 经历资产与优势

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/experiences` | 列出经历资产 | 是 |
| POST | `/api/experiences` | 创建经历资产 | 是 |
| PUT | `/api/experiences/{id}` | 更新经历资产 | 是 |
| DELETE | `/api/experiences/{id}` | 删除经历资产 | 是 |
| GET | `/api/strengths` | 列出优势分析 | 是 |
| POST | `/api/strengths` | 创建优势记录 | 是 |

### 系统

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/health` | 健康检查 | 否 |
| GET | `/health` | 根路径健康检查 | 否 |

---

## 五、数据模型

共 14 张表，核心表如下：

### users / profiles / jobs / applications / resumes / interview_preps

详见 `models.py`，与用户求职流程直接相关。

### job_favorites（岗位收藏表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| user_id | Integer | 外键 → users.id |
| job_id | Integer | 外键 → jobs.id |
| created_at | DateTime | 收藏时间 |

### job_cache（岗位缓存表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| source | String | 数据源（himalayas/remotive等） |
| source_id | String | 源平台唯一ID |
| expires_at | DateTime | 过期时间 |

### experiences（经历资产表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| user_id | Integer | 外键 |
| type | String | 类型（project/internship/course等） |
| title | String | 标题 |
| background/task/action/result | Text | STAR结构 |
| evidence | Text | 证据/成果 |

### strengths（优势分析表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| user_id | Integer | 外键 |
| name | String | 优势名称 |
| classification | String | 分类（fact/assumption/inference） |
| confidence | String | 信心度（high/medium/low） |

### interview_practice_sessions（模拟面试表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| user_id | Integer | 外键 |
| target_role | String | 目标岗位 |
| status | String | active/ended |
| transcript | JSON | 对话记录 |

### platform_auths（平台授权表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| user_id | Integer | 外键 |
| platform | String | boss/liepin/51job |
| cookies | Text | Cookie JSON |
| token | Text | 猎聘MCP Token |
| status | String | active/expired/disconnected |

---

## 六、数据获取架构

### 5平台搜索流程

```
用户搜索请求
    ├── 猎聘 MCP API（用户Token授权）
    ├── BOSS直聘（Playwright + 用户Cookie）
    ├── 前程无忧（Playwright + 用户Cookie）
    ├── Himalayas Jobs API（公开API）
    └── Remotive API（公开API）
         ↓
    结果聚合 + 去重 + 评分
         ↓
    返回前端展示
```

### 合规边界

| 等级 | 数据源 | 方式 | 状态 |
|------|--------|------|------|
| 合规 | 猎聘MCP API | 用户Token授权 | 已集成 |
| 合规 | Himalayas Jobs API | 公开API | 已集成 |
| 合规 | Remotive API | 公开API | 已集成 |
| 合规 | 用户手动粘贴JD | 前端输入 | 已实现 |
| 灰色 | Playwright(BOSS直聘) | 用户登录态 | 已实现 |
| 灰色 | Playwright(前程无忧) | 用户登录态 | 已实现 |

---

## 七、扩展指南

### 添加新页面（前端）

1. 在 `frontend/src/pages/` 下新建页面组件
2. 在 `App.tsx` 中添加路由
3. 在 `Layout.tsx` 侧边栏中添加导航链接
4. 如需新类型，在 `types/index.ts` 中添加接口定义

### 添加新API端点（后端）

1. 在 `backend/routers/` 下新建路由文件
2. 在 `backend/models.py` 中添加新数据模型（如需新表）
3. 在 `backend/main.py` 中注册路由
4. 重启后端服务

### 添加新数据源

1. 在 `job_sources.py` 或新建文件中实现数据获取逻辑
2. 在 `jobs.py` 的 `search_jobs` 中添加调用
3. 确保返回统一的数据格式

---

## 八、认证流程

```
1. 用户注册/登录 → 后端返回 JWT Token
2. 前端将 Token 存入 localStorage
3. Axios 拦截器自动在请求头添加 Authorization: Bearer <token>
4. 后端 get_current_user 依赖解析 Token，获取当前用户
5. 401 响应时，Axios 拦截器自动清除 Token 并跳转登录页
```

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