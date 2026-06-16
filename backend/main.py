import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import auth, profile, jobs, resumes, applications, interviews, feedback, career

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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(resumes.router, prefix="/api")
app.include_router(applications.router, prefix="/api")
app.include_router(career.router, prefix="/api")
app.include_router(interviews.router, prefix="/api")
app.include_router(feedback.router, prefix="/api")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "1.0.0"}