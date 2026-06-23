import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()  # Load .env before importing routers that use PINME_API_KEY

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from database import engine, Base
from routers import auth, profile, jobs, jobs_search, jobs_analysis, resumes, applications, interviews, feedback, career, seed, notifications, experiences, strengths, platform_auth, jd_ocr

DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:5176",
    "https://*.pinme.com",
    "http://localhost:3000",
    "https://dada-jobhunt.pages.dev",
    "https://*.pages.dev",
    "https://*.loca.lt",
]

cors_env = os.getenv("CORS_ALLOW_ORIGINS", "")
if cors_env:
    if cors_env == "*":
        ALLOW_ORIGINS = ["*"]
    else:
        ALLOW_ORIGINS = [origin.strip() for origin in cors_env.split(",") if origin.strip()]
else:
    ALLOW_ORIGINS = DEFAULT_CORS_ORIGINS


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="转型导航 CareerShift API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=ALLOW_ORIGINS != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(jobs_search.router, prefix="/api")
app.include_router(jobs_analysis.router, prefix="/api")
app.include_router(resumes.router, prefix="/api")
app.include_router(applications.router, prefix="/api")
app.include_router(career.router, prefix="/api")
app.include_router(interviews.router, prefix="/api")
app.include_router(feedback.router, prefix="/api")
app.include_router(seed.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(experiences.router, prefix="/api")
app.include_router(strengths.router, prefix="/api")
app.include_router(platform_auth.router, prefix="/api/platform-auth", tags=["platform-auth"])
app.include_router(jd_ocr.router, prefix="/api")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/health")
def root_health_check():
    return {"status": "ok", "version": "1.0.0"}


# ============ 生产环境：服务前端静态文件 ============
FRONTEND_DIST = Path(__file__).parent / "frontend-dist"
IS_PRODUCTION = os.getenv("PRODUCTION", "").lower() == "true"

if IS_PRODUCTION and FRONTEND_DIST.exists():
    # 挂载静态资源（JS/CSS/图片等）
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    # SPA 回退：所有非 API 路由返回 index.html
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")
