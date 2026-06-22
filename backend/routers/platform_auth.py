from datetime import datetime, timedelta
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Body
from sqlalchemy.orm import Session
from database import get_db
from models import User, PlatformAuth
from auth import get_current_user


class LiepinTokenRequest(BaseModel):
    token: str

# 可选导入：liepin_mcp_client 和 playwright_crawler 会在后续 Task 中实现
try:
    from liepin_mcp_client import LiepinMCPClient
except ImportError:
    LiepinMCPClient = None

try:
    import playwright_crawler
except ImportError:
    playwright_crawler = None

router = APIRouter(tags=["platform-auth"])

# 平台常量
SUPPORTED_PLATFORMS = {"boss", "liepin", "51job"}
COOKIE_PLATFORMS = {"boss", "51job"}  # 使用 Playwright Cookie 登录的平台
COOKIE_EXPIRE_DAYS = 7
LIEPIN_TOKEN_EXPIRE_DAYS = 90


@router.get("/status")
async def get_platform_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """返回当前用户所有平台的登录状态"""
    auths = db.query(PlatformAuth).filter(PlatformAuth.user_id == user.id).all()
    auth_map = {a.platform: a for a in auths}

    platforms = []
    for platform in ["boss", "liepin", "51job"]:
        auth = auth_map.get(platform)
        if auth:
            platforms.append({
                "platform": platform,
                "status": auth.status,
                "expires_at": auth.expires_at.isoformat() if auth.expires_at else None,
            })
        else:
            platforms.append({
                "platform": platform,
                "status": "disconnected",
                "expires_at": None,
            })

    return {"platforms": platforms}


@router.post("/liepin/token")
async def save_liepin_token(
    req: LiepinTokenRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """保存猎聘 MCP Token"""
    token = req.token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token 不能为空")

    if LiepinMCPClient is None:
        raise HTTPException(status_code=503, detail="猎聘 MCP 客户端未配置")

    # 验证 Token 有效性
    try:
        client = LiepinMCPClient(token)
        valid = client.validate_token()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Token 验证失败: {str(e)}")

    if not valid:
        raise HTTPException(status_code=400, detail="猎聘 Token 无效")

    # 保存或更新 Token
    expires_at = datetime.utcnow() + timedelta(days=LIEPIN_TOKEN_EXPIRE_DAYS)
    auth = db.query(PlatformAuth).filter(
        PlatformAuth.user_id == user.id,
        PlatformAuth.platform == "liepin",
    ).first()

    if auth:
        auth.token = token
        auth.status = "active"
        auth.expires_at = expires_at
    else:
        auth = PlatformAuth(
            user_id=user.id,
            platform="liepin",
            token=token,
            status="active",
            expires_at=expires_at,
        )
        db.add(auth)

    db.commit()
    db.refresh(auth)

    return {
        "status": "active",
        "expires_at": expires_at.isoformat(),
    }


@router.get("/liepin/validate")
async def validate_liepin_token(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """验证猎聘 Token 是否有效"""
    if LiepinMCPClient is None:
        raise HTTPException(status_code=503, detail="猎聘 MCP 客户端未配置")

    auth = db.query(PlatformAuth).filter(
        PlatformAuth.user_id == user.id,
        PlatformAuth.platform == "liepin",
    ).first()

    if not auth or not auth.token:
        return {"valid": False, "expires_at": None}

    try:
        client = LiepinMCPClient(auth.token)
        valid = client.validate_token()
    except Exception:
        valid = False

    return {
        "valid": valid,
        "expires_at": auth.expires_at.isoformat() if auth.expires_at else None,
    }


@router.post("/{platform}/login")
async def login_platform(
    platform: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
):
    """启动 Playwright 登录流程（BOSS直聘、前程无忧）"""
    if platform not in COOKIE_PLATFORMS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的平台: {platform}，猎聘请使用 /liepin/token",
        )

    if playwright_crawler is None:
        raise HTTPException(status_code=503, detail="Playwright 爬虫模块未配置")

    # 登录是耗时操作，使用 BackgroundTasks 异步执行。
    # 必须在任务内创建独立的 db Session，不能复用请求的 Session（请求结束后会关闭）。
    def _run_login_task(platform: str, user_id: int):
        from database import SessionLocal
        task_db = SessionLocal()
        try:
            playwright_crawler.login_and_save_cookies(platform, user_id, task_db)
        finally:
            task_db.close()

    background_tasks.add_task(_run_login_task, platform, user.id)

    return {
        "status": "logging_in",
        "message": "请在弹出的浏览器窗口中完成登录",
    }


@router.delete("/{platform}")
async def disconnect_platform(
    platform: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """清除登录状态"""
    if platform not in SUPPORTED_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"不支持的平台: {platform}")

    auth = db.query(PlatformAuth).filter(
        PlatformAuth.user_id == user.id,
        PlatformAuth.platform == platform,
    ).first()

    if auth:
        db.delete(auth)
        db.commit()

    return {"status": "disconnected"}
