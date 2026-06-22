from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import User, Experience
from auth import get_current_user

router = APIRouter(tags=["experiences"])

VALID_TYPES = {"project", "internship", "course", "club", "self_study", "part_time"}


class ExperienceBase(BaseModel):
    type: str = "project"
    title: str = ""
    background: str = ""
    task: str = ""
    action: str = ""
    method_tool: str = ""
    result: str = ""
    evidence: str = ""


class ExperienceCreate(ExperienceBase):
    pass


class ExperienceUpdate(BaseModel):
    type: Optional[str] = None
    title: Optional[str] = None
    background: Optional[str] = None
    task: Optional[str] = None
    action: Optional[str] = None
    method_tool: Optional[str] = None
    result: Optional[str] = None
    evidence: Optional[str] = None


def _serialize_experience(exp: Experience) -> dict:
    return {
        "id": exp.id,
        "user_id": exp.user_id,
        "type": exp.type or "project",
        "title": exp.title or "",
        "background": exp.background or "",
        "task": exp.task or "",
        "action": exp.action or "",
        "method_tool": exp.method_tool or "",
        "result": exp.result or "",
        "evidence": exp.evidence or "",
        "created_at": exp.created_at.isoformat() if isinstance(exp.created_at, datetime) else str(exp.created_at),
        "updated_at": exp.updated_at.isoformat() if isinstance(exp.updated_at, datetime) else str(exp.updated_at),
    }


@router.get("/experiences")
def list_experiences(
    type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前用户的经历列表。"""
    q = db.query(Experience).filter(Experience.user_id == current_user.id)
    if type:
        q = q.filter(Experience.type == type)
    items = q.order_by(Experience.created_at.desc()).all()
    return [_serialize_experience(e) for e in items]


@router.post("/experiences")
def create_experience(
    req: ExperienceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """创建新经历。"""
    if req.type and req.type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"type 必须是 {VALID_TYPES} 之一")

    exp = Experience(
        user_id=current_user.id,
        type=req.type,
        title=req.title,
        background=req.background,
        task=req.task,
        action=req.action,
        method_tool=req.method_tool,
        result=req.result,
        evidence=req.evidence,
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return _serialize_experience(exp)


@router.put("/experiences/{exp_id}")
def update_experience(
    exp_id: int,
    req: ExperienceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """更新经历。"""
    exp = (
        db.query(Experience)
        .filter(Experience.id == exp_id, Experience.user_id == current_user.id)
        .first()
    )
    if not exp:
        raise HTTPException(status_code=404, detail="经历不存在")

    update_data = req.model_dump(exclude_unset=True)
    if "type" in update_data and update_data["type"] and update_data["type"] not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"type 必须是 {VALID_TYPES} 之一")

    for key, value in update_data.items():
        setattr(exp, key, value)

    exp.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(exp)
    return _serialize_experience(exp)


@router.delete("/experiences/{exp_id}")
def delete_experience(
    exp_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """删除经历。"""
    exp = (
        db.query(Experience)
        .filter(Experience.id == exp_id, Experience.user_id == current_user.id)
        .first()
    )
    if not exp:
        raise HTTPException(status_code=404, detail="经历不存在")
    db.delete(exp)
    db.commit()
    return {"message": "已删除"}
