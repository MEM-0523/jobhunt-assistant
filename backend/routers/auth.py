from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import secrets
from database import get_db
from models import User
from auth import get_password_hash, verify_password, create_access_token, get_current_user
from seed import seed_demo_data
from email_service import send_verification_email, send_reset_email, is_configured as email_configured

router = APIRouter(tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    created_at: str

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


@router.post("/auth/register", response_model=AuthResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=req.email,
        password_hash=get_password_hash(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    seed_demo_data(user.id, db)

    token = create_access_token({"sub": user.id})
    return AuthResponse(
        access_token=token,
        user=UserResponse(id=user.id, email=user.email, created_at=str(user.created_at)),
    )


@router.post("/auth/login", response_model=AuthResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": user.id})
    return AuthResponse(
        access_token=token,
        user=UserResponse(id=user.id, email=user.email, created_at=str(user.created_at)),
    )


@router.get("/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        created_at=str(current_user.created_at),
    )


# ========== 邮箱验证 ==========

class SendVerificationRequest(BaseModel):
    email: str


class VerifyEmailRequest(BaseModel):
    email: str
    code: str


@router.post("/auth/send-verification")
def send_verification(req: SendVerificationRequest, db: Session = Depends(get_db)):
    """发送邮箱验证码"""
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="该邮箱未注册")

    if user.is_verified:
        return {"message": "邮箱已验证，无需重复操作"}

    # 生成6位验证码
    code = f"{secrets.randbelow(1000000):06d}"
    user.verification_code = code
    user.verification_expires = datetime.utcnow() + timedelta(minutes=15)
    db.commit()

    if email_configured():
        success = send_verification_email(user.email, code)
        if not success:
            raise HTTPException(status_code=500, detail="邮件发送失败，请稍后重试")
        return {"message": "验证码已发送到你的邮箱"}
    else:
        # 未配置邮件服务时，返回验证码（仅开发环境）
        return {"message": "邮件服务未配置（开发模式）", "dev_code": code}


@router.post("/auth/verify-email")
def verify_email(req: VerifyEmailRequest, db: Session = Depends(get_db)):
    """验证邮箱"""
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="该邮箱未注册")

    if user.is_verified:
        return {"message": "邮箱已验证"}

    if not user.verification_code:
        raise HTTPException(status_code=400, detail="请先发送验证码")

    if datetime.utcnow() > user.verification_expires:
        raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")

    if user.verification_code != req.code:
        raise HTTPException(status_code=400, detail="验证码不正确")

    user.is_verified = True
    user.verification_code = None
    user.verification_expires = None
    db.commit()
    return {"message": "邮箱验证成功"}


# ========== 密码重置 ==========

class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """发送密码重置邮件"""
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        # 出于安全考虑，不提示邮箱是否存在
        return {"message": "如果该邮箱已注册，你将收到重置密码邮件"}

    # 生成重置token
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_expires = datetime.utcnow() + timedelta(minutes=30)
    db.commit()

    if email_configured():
        success = send_reset_email(user.email, token)
        if not success:
            raise HTTPException(status_code=500, detail="邮件发送失败，请稍后重试")
    # 未配置邮件服务时，静默跳过（不暴露token）

    return {"message": "如果该邮箱已注册，你将收到重置密码邮件"}


@router.post("/auth/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """重置密码"""
    user = db.query(User).filter(User.reset_token == req.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="重置链接无效")

    if datetime.utcnow() > user.reset_expires:
        raise HTTPException(status_code=400, detail="重置链接已过期，请重新申请")

    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="密码至少6位")

    user.password_hash = get_password_hash(req.new_password)
    user.reset_token = None
    user.reset_expires = None
    db.commit()
    return {"message": "密码重置成功，请使用新密码登录"}