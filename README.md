---
title: AI求职助手 - 转型导航
emoji: 🧭
colorFrom: purple
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# 求职助手Web

基于 React + FastAPI 的全栈求职管理平台，覆盖岗位搜索、能力评估、简历优化、面试准备全链路。

## 核心功能

| 模块 | 功能 |
|------|------|
| 岗位搜索 | 5平台聚合搜索（猎聘/BOSS直聘/前程无忧/Himalayas/Remotive） |
| 能力迁移 | 转型路径分析（知识库+AI双层） |
| 职业测评 | 霍兰德RIASEC + 大五人格 + 职业适应力 |
| JD直推 | 粘贴JD文本AI深度分析（7-Block） |
| 简历优化 | 上传解析 + AI 6阶段Pipeline优化 |
| 面试准备 | AI全案生成 + 模拟面试训练 |
| 投递追踪 | 全流程状态管理 + 薪资谈判 |
| 数据看板 | 热力图、饼图、漏斗图、周报 |

## 技术栈

- **前端**: React 19 + TypeScript + Vite + Tailwind CSS + Recharts
- **后端**: FastAPI + Python + SQLAlchemy + SQLite
- **AI**: Pinme API (gpt-4o-mini)
- **数据源**: 猎聘MCP API + Playwright反检测爬虫 + Himalayas/Remotive公开API

## 快速启动（本地开发）

### 1. 后端

```bash
cd backend
source venv/bin/activate
lsof -ti:8000 | xargs kill -9 2>/dev/null
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

API 运行在 `http://localhost:8000`，API文档 `http://localhost:8000/docs`

### 2. 前端

```bash
cd frontend
npm run dev
```

开发服务器运行在 `http://localhost:5173`

## 环境变量

### 后端 `backend/.env`

| 变量 | 说明 |
|------|------|
| `PINME_API_KEY` | AI API密钥（必需） |
| `PINME_BASE_URL` | AI API地址（默认 pinme.cloud） |
| `PINME_PROJECT_NAME` | 项目名称 |
| `DATABASE_URL` | PostgreSQL连接串（可选，默认SQLite） |

## 目录结构

```
12-求职助手Web/
├── frontend/          # React前端
│   └── src/
│       ├── components/  # 通用组件
│       ├── pages/       # 页面组件
│       ├── stores/      # Zustand状态管理
│       └── api/         # API客户端
├── backend/           # FastAPI后端
│   ├── routers/        # API路由
│   ├── data/           # 知识库数据
│   └── utils/          # 工具函数
└── docs/              # 项目文档
    └── archive/        # 历史文档归档
```