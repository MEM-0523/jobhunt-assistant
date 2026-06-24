# ============ Stage 1: 构建前端 ============
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --silent
COPY frontend/ ./
RUN npm run build

# ============ Stage 2: 后端 + 服务 ============
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ ./backend/

# 复制前端构建产物
COPY --from=frontend-build /app/frontend/dist ./backend/frontend-dist

# 工作目录设为 backend
WORKDIR /app/backend

# Hugging Face Spaces 要求端口 7860
EXPOSE 7860

# HF Spaces 持久化目录（容器重启不丢失）
RUN mkdir -p /data

ENV PYTHONUNBUFFERED=1
ENV PRODUCTION=true
# SQLite 数据库放在持久化目录，容器重启数据不丢失
ENV DATABASE_URL=sqlite:////data/job_assistant.db

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]