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

# 🧭 AI求职助手 · 转型导航 CareerShift

面向建筑等行业转型者的AI求职全流程助手，提供岗位搜索、JD分析、能力迁移、简历优化、面试准备等一站式服务。

## 功能模块

| 模块 | 功能 | AI能力 |
|------|------|--------|
| 岗位搜索 | 5平台聚合搜索 | - |
| 能力迁移 | 转型路径分析 | 知识库+AI双层 |
| JD直推 | 7-Block深度分析 | AI分析 |
| 简历优化 | 6阶段AI Pipeline | AI优化 |
| 面试准备 | 全案生成+模拟训练 | AI生成 |
| 职业测评 | 87题专业量表 | AI诊断 |
| 投递追踪 | 全流程状态管理 | - |
| 数据看板 | 热力图+饼图+漏斗 | - |

## 本地开发

```bash
# 后端
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 前端
cd frontend
npm install
npm run dev
```

## 技术栈

- **前端**: React 19 + Vite + Tailwind CSS
- **后端**: FastAPI + SQLAlchemy + SQLite
- **AI**: Pinme API (gpt-4o-mini)
- **部署**: Docker + Hugging Face Spaces
- **数据源**: 猎聘MCP + Himalayas + Remotive

## 架构

```
用户浏览器 → Hugging Face Spaces (Docker)
              ├── FastAPI (port 7860)
              ├── 前端静态文件 (React SPA)
              └── SQLite 数据库
```