# 求职助手Web

基于 React + FastAPI 的全栈求职管理平台，帮助用户追踪职位申请、管理简历、准备面试。

## 技术栈

- **前端**: React 19 + TypeScript + Vite + Tailwind CSS
- **后端**: FastAPI + Python + SQLAlchemy + SQLite
- **部署**: Pinme Platform

## 快速开始（本地开发）

### 前端

```bash
cd frontend
npm install
npm run dev
```

开发服务器运行在 `http://localhost:5173`

### 后端

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API 运行在 `http://localhost:8000`

## 部署

使用 Pinme 平台一键部署：

```bash
chmod +x deploy.sh
./deploy.sh
```

或分别部署：

```bash
# 部署前端
cd frontend && npm run build && npx pinme save

# 部署后端
cd ../backend && npx pinme save
```

## 环境变量

### 前端

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_API_URL` | 后端 API 地址 | `http://localhost:8000` |

### 后端

| 变量 | 说明 |
|------|------|
| `JWT_SECRET_KEY` | JWT 签名密钥（生产环境务必修改） |
| `AI_API_KEY` | AI 服务 API 密钥 |
| `FEISHU_APP_TOKEN` | 飞书应用 Token |

环境变量配置方式：
- 本地开发：复制 `.env.example` 为 `.env` 并填写
- 生产环境：在 `backend/wrangler.toml` 的 `[vars]` 中配置