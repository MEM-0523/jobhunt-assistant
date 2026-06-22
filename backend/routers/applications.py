from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from database import get_db
from models import User, Application, Job, Profile
from auth import get_current_user

router = APIRouter(tags=["applications"])

STATUS_FLOW = {
    "待投递": ["已投递"],
    "已投递": ["初筛通过", "初筛拒绝", "面试邀约", "无回应"],
    "初筛通过": ["面试邀约"],
    "初筛拒绝": [],
    "面试邀约": ["面试中", "无回应"],
    "无回应": [],
    "面试中": ["面试通过", "面试拒绝"],
    "面试通过": ["offer"],
    "面试拒绝": [],
    "offer": ["接受", "拒绝"],
    "接受": [],
    "拒绝": [],
}

FUNNEL_STAGES = ["待投递", "已投递", "面试邀约", "面试中", "offer"]

STATUS_CATEGORY = {
    "待投递": "待投递",
    "已投递": "已投递",
    "初筛通过": "已投递",
    "初筛拒绝": "已拒绝",
    "面试邀约": "面试中",
    "无回应": "已投递",
    "面试中": "面试中",
    "面试通过": "面试中",
    "面试拒绝": "已拒绝",
    "offer": "Offer",
    "接受": "Offer",
    "拒绝": "已拒绝",
}


def _serialize_app(app: Application) -> dict:
    job = app.job
    return {
        "id": app.id,
        "user_id": app.user_id,
        "job_id": app.job_id,
        "job_title": job.title if job else None,
        "company": job.company if job else None,
        "status": app.status,
        "applied_at": app.applied_at.isoformat() if isinstance(app.applied_at, datetime) else str(app.applied_at) if app.applied_at else None,
        "notes": app.notes or "",
        "is_demo": bool(app.is_demo),
        "created_at": app.created_at.isoformat() if isinstance(app.created_at, datetime) else str(app.created_at),
        "updated_at": app.updated_at.isoformat() if isinstance(app.updated_at, datetime) else str(app.updated_at),
    }


class CreateApplicationRequest(BaseModel):
    job_id: int
    status: str = "待投递"
    applied_at: Optional[str] = None
    notes: str = ""


class UpdateApplicationRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


@router.get("/applications")
def list_applications(
    status: Optional[str] = Query(None),
    is_demo: Optional[bool] = Query(None, description="true=只看Demo记录，false=只看真实记录，不传=全部"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Application).filter(Application.user_id == current_user.id)

    if status:
        # Map filter category to actual statuses
        if status == "已拒绝":
            q = q.filter(Application.status.in_(["初筛拒绝", "面试拒绝", "拒绝"]))
        elif status == "面试中":
            q = q.filter(Application.status.in_(["面试邀约", "面试中", "面试通过", "面试拒绝"]))
        elif status == "Offer":
            q = q.filter(Application.status.in_(["offer", "接受", "拒绝"]))
        else:
            q = q.filter(Application.status == status)

    if is_demo is not None:
        q = q.filter(Application.is_demo.is_(is_demo))

    apps = q.order_by(Application.applied_at.desc().nullslast(), Application.created_at.desc()).all()
    return [_serialize_app(a) for a in apps]


@router.post("/applications")
def create_application(
    req: CreateApplicationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify job belongs to user
    job = db.query(Job).filter(Job.id == req.job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="岗位不存在")

    applied_at = None
    if req.applied_at:
        try:
            applied_at = datetime.fromisoformat(req.applied_at.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            applied_at = datetime.utcnow()
    else:
        applied_at = datetime.utcnow()

    app = Application(
        user_id=current_user.id,
        job_id=req.job_id,
        status=req.status,
        applied_at=applied_at,
        notes=req.notes,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return _serialize_app(app)


@router.put("/applications/{app_id}")
def update_application(
    app_id: int,
    req: UpdateApplicationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app = db.query(Application).filter(
        Application.id == app_id, Application.user_id == current_user.id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="投递记录不存在")

    update_data = req.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(app, key, value)

    app.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(app)
    return _serialize_app(app)


@router.delete("/applications/{app_id}")
def delete_application(
    app_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app = db.query(Application).filter(
        Application.id == app_id, Application.user_id == current_user.id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="投递记录不存在")
    db.delete(app)
    db.commit()
    return {"message": "已删除"}


@router.get("/applications/stats")
def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.id

    # Jobs searched count
    total_jobs_searched = db.query(func.count(Job.id)).filter(
        Job.user_id == user_id
    ).scalar() or 0

    apps = db.query(Application).filter(Application.user_id == user_id).all()
    total = len(apps)

    # by_status: count per actual status
    by_status: dict[str, int] = {}
    for s in STATUS_FLOW:
        by_status[s] = 0
    for a in apps:
        by_status[a.status] = by_status.get(a.status, 0) + 1

    # Dashboard stats
    in_interview = sum(
        1 for a in apps
        if a.status in ("面试邀约", "面试中", "面试通过")
    )
    offers = sum(
        1 for a in apps
        if a.status in ("offer", "接受")
    )

    # funnel: cumulative counts through stages
    funnel: dict[str, int] = {}
    cumulative = total
    for stage in FUNNEL_STAGES:
        funnel[stage] = cumulative
        if stage == "待投递":
            cumulative -= by_status.get("待投递", 0)
        elif stage == "已投递":
            cumulative -= by_status.get("已投递", 0) + by_status.get("初筛通过", 0) + by_status.get("初筛拒绝", 0) + by_status.get("无回应", 0)
        elif stage == "面试邀约":
            cumulative -= by_status.get("面试邀约", 0)
        elif stage == "面试中":
            cumulative -= by_status.get("面试中", 0) + by_status.get("面试通过", 0) + by_status.get("面试拒绝", 0)
        elif stage == "offer":
            pass

    # recent_activities: last 5 with type/description format
    recent = []
    sorted_apps = sorted(apps, key=lambda a: a.updated_at or a.created_at, reverse=True)
    for a in sorted_apps[:5]:
        job_title = a.job.title if a.job else ""
        company = a.job.company if a.job else ""
        ts = a.updated_at or a.created_at
        recent.append({
            "type": "application",
            "description": f"投递了{company} - {job_title}：{a.status}",
            "created_at": ts.isoformat() if isinstance(ts, datetime) else str(ts),
        })

    # Weekly changes
    now = datetime.utcnow()
    this_week_start = now - timedelta(days=now.weekday())
    this_week_start = this_week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    this_week_searches = db.query(func.count(Job.id)).filter(
        Job.user_id == user_id,
        Job.created_at >= this_week_start
    ).scalar() or 0

    this_week_apps = db.query(func.count(Application.id)).filter(
        Application.user_id == user_id,
        Application.created_at >= this_week_start
    ).scalar() or 0

    this_week_interviews = db.query(func.count(Application.id)).filter(
        Application.user_id == user_id,
        Application.status.in_(["面试邀约", "面试中", "面试通过"]),
        Application.updated_at >= this_week_start
    ).scalar() or 0

    return {
        "total": total,
        "by_status": by_status,
        "funnel": funnel,
        "recent_activities": recent,
        "total_jobs_searched": total_jobs_searched,
        "total_applications": total,
        "in_interview": in_interview,
        "offers": offers,
        "status_breakdown": by_status,
        "weekly_change": {
            "searches": this_week_searches,
            "applications": this_week_apps,
            "interviews": this_week_interviews,
        },
    }


@router.get("/applications/{app_id}/salary-advice")
def salary_advice(
    app_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app = db.query(Application).filter(
        Application.id == app_id, Application.user_id == current_user.id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="投递记录不存在")

    if app.status not in ("offer", "接受", "拒绝"):
        return {
            "eligible": False,
            "message": "该岗位尚未进入Offer阶段",
        }

    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    salary_min = profile.salary_min if profile else 25
    salary_max = profile.salary_max if profile else 35

    return {
        "eligible": True,
        "market_range": f"{salary_min}-{salary_max}K",
        "your_expectation": f"{salary_min}-{salary_max}K",
        "negotiation_tips": [
            "先让对方出价，不要先报数字",
            "准备好你的市场价值证明（一注资质、9年经验）",
            "除了薪资，关注期权、培训预算、弹性工作等福利",
            f"设定好最低底线，低于{salary_min}K不接",
        ],
        "counter_offer_script": f"感谢贵公司的Offer。根据我的市场调研和自身资质（一级注册建筑师、9年全流程经验），我认为{salary_min}-{salary_max}K的薪资范围更符合我的价值。同时我也很看重成长空间和团队氛围，希望能找到一个双方都满意的方案。",
        "checklist": [
            "确认薪资结构（基本工资/绩效/年终奖比例）",
            "确认试用期薪资是否打折",
            "确认五险一金缴纳基数和比例",
            "确认年假/病假/加班政策",
            "确认入职时间和报到材料",
        ],
    }