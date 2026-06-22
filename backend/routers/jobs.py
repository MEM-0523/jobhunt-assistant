import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, Job, JobFavorite, Profile, Application
from auth import get_current_user
from datetime import datetime, timedelta

router = APIRouter(tags=["jobs"])

@router.get("/jobs/favorites")
def list_favorites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    favorites = (
        db.query(JobFavorite)
        .filter(JobFavorite.user_id == current_user.id)
        .order_by(JobFavorite.created_at.desc())
        .all()
    )

    results = []
    for fav in favorites:
        job = fav.job
        if not job:
            db.delete(fav)
            db.commit()
            continue
        results.append({
            "id": job.id,
            "title": job.title,
            "company": job.company,
            "salary": job.salary,
            "city": job.city,
            "platform": job.platform,
            "jd_text": job.jd_text,
            "match_score": job.match_score if job.match_score else None,
            "rating": job.rating if job.rating else None,
            "status": job.status,
            "jd_url": job.jd_url,
            "created_at": job.created_at.isoformat() if isinstance(job.created_at, datetime) else str(job.created_at),
            "favorited_at": fav.created_at.isoformat() if isinstance(fav.created_at, datetime) else str(fav.created_at),
        })

    return {"results": results, "total": len(results)}

@router.get("/jobs/data-sources")
def get_data_source_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get statistics about job data sources for the current user."""
    from sqlalchemy import func

    user_jobs = db.query(Job).filter(Job.user_id == current_user.id).all()

    # Count by platform
    platform_counts: dict[str, int] = {}
    for job in user_jobs:
        p = job.platform or "unknown"
        platform_counts[p] = platform_counts.get(p, 0) + 1

    # Count cached jobs by source
    from models import JobCache
    cache_stats = db.query(
        JobCache.source, func.count(JobCache.id)
    ).group_by(JobCache.source).all()
    cache_counts = {src: cnt for src, cnt in cache_stats}

    return {
        "user_jobs_by_platform": platform_counts,
        "cached_jobs_by_source": cache_counts,
        "total_user_jobs": len(user_jobs),
    }

@router.get("/jobs/heatmap")
def get_heatmap_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return job distribution data for heatmap: city × industry with count and avg salary."""
    from collections import defaultdict
    import re

    user_jobs = db.query(Job).filter(Job.user_id == current_user.id).all()

    # Group by city and industry
    groups: dict[tuple[str, str], list[Job]] = defaultdict(list)
    for job in user_jobs:
        city = job.city or "未知"
        # Infer industry from job title keywords
        title_lower = job.title.lower()
        if any(kw in title_lower for kw in ["ai", "人工智能", "大模型", "算法", "机器学习"]):
            industry = "AI/算法"
        elif any(kw in title_lower for kw in ["产品", "产品经理"]):
            industry = "产品"
        elif any(kw in title_lower for kw in ["前端", "后端", "全栈", "开发", "工程师", "java", "python", "go", "react"]):
            industry = "技术开发"
        elif any(kw in title_lower for kw in ["设计", "建筑", "bim", "城市"]):
            industry = "建筑/设计"
        elif any(kw in title_lower for kw in ["运营", "市场", "销售", "bd", "商务"]):
            industry = "运营/市场"
        elif any(kw in title_lower for kw in ["总监", "经理", "管理", "人力", "hr"]):
            industry = "管理"
        else:
            industry = "其他"
        groups[(city, industry)].append(job)

    heatmap = []
    for (city, industry), jobs in groups.items():
        salaries = []
        for j in jobs:
            s = re.search(r'(\d+)', j.salary or "")
            if s:
                salaries.append(int(s.group(1)))
        avg_salary = round(sum(salaries) / len(salaries)) if salaries else 0
        heatmap.append({
            "city": city,
            "industry": industry,
            "count": len(jobs),
            "avg_salary_k": avg_salary,
        })

    return {"heatmap": heatmap, "total": len(user_jobs)}

@router.get("/jobs/weekly-report")
def weekly_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Aggregate this week's job hunting data."""
    from collections import Counter
    from sqlalchemy import func

    now = datetime.utcnow()
    this_week_start = now - timedelta(days=now.weekday())
    this_week_start = this_week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    user_id = current_user.id

    # Searches this week (jobs created this week)
    searches_this_week = db.query(func.count(Job.id)).filter(
        Job.user_id == user_id,
        Job.created_at >= this_week_start
    ).scalar() or 0

    # New jobs found this week
    new_jobs_found = searches_this_week

    # New applications this week
    new_applications = db.query(func.count(Application.id)).filter(
        Application.user_id == user_id,
        Application.created_at >= this_week_start
    ).scalar() or 0

    # Status changes this week
    apps_updated_this_week = db.query(Application).filter(
        Application.user_id == user_id,
        Application.updated_at >= this_week_start
    ).all()

    status_changes: dict[str, int] = {}
    for app in apps_updated_this_week:
        if app.status in ("面试邀约", "面试通过", "offer"):
            status_changes[app.status] = status_changes.get(app.status, 0) + 1

    # Hot keywords: most common in job titles this week
    week_jobs = db.query(Job).filter(
        Job.user_id == user_id,
        Job.created_at >= this_week_start
    ).all()

    keyword_counter: Counter = Counter()
    for job in week_jobs:
        for word in job.title.replace("（", " ").replace("）", " ").replace("(", " ").replace(")", " ").split():
            if len(word) >= 2:
                keyword_counter[word] += 1
    hot_keywords = [kw for kw, _ in keyword_counter.most_common(5)]

    # Suggestions
    suggestions: list[str] = []
    interview_count = status_changes.get("面试邀约", 0)
    pass_count = status_changes.get("面试通过", 0)
    offer_count = status_changes.get("offer", 0)

    if interview_count > 0:
        suggestions.append(f"本周收到{interview_count}个面试邀约，建议重点准备面试")
    if searches_this_week == 0:
        suggestions.append("本周尚未搜索岗位，建议增加搜索频率以获取更多机会")
    if new_applications == 0 and searches_this_week > 0:
        suggestions.append("本周有搜索但未投递，建议对匹配度高的岗位尽快投递")
    if pass_count > 0:
        suggestions.append(f"本周{pass_count}个面试通过，建议及时跟进后续流程")
    if offer_count > 0:
        suggestions.append(f"恭喜！本周收到{offer_count}个Offer，请使用薪资谈判助手评估方案")
    if not suggestions:
        suggestions.append("本周暂无特别提醒，保持良好的求职节奏")
    if hot_keywords:
        suggestions.append(f"热门方向「{'、'.join(hot_keywords[:3])}」岗位活跃，建议增加相关搜索")

    return {
        "searches_this_week": searches_this_week,
        "new_jobs_found": new_jobs_found,
        "new_applications": new_applications,
        "status_changes": status_changes,
        "hot_keywords": hot_keywords,
        "suggestions": suggestions,
    }

@router.get("/jobs/{job_id}")
def get_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        return {"error": "Job not found"}

    fav = (
        db.query(JobFavorite)
        .filter(JobFavorite.user_id == current_user.id, JobFavorite.job_id == job_id)
        .first()
    )

    return {
        "id": job.id,
        "title": job.title,
        "company": job.company,
        "salary": job.salary,
        "city": job.city,
        "platform": job.platform,
        "jd_text": job.jd_text,
        "match_score": job.match_score if job.match_score else None,
        "rating": job.rating if job.rating else None,
        "status": job.status,
        "jd_url": job.jd_url,
        "created_at": job.created_at.isoformat() if isinstance(job.created_at, datetime) else str(job.created_at),
        "favorited_at": fav.created_at.isoformat() if fav and isinstance(fav.created_at, datetime) else str(fav.created_at) if fav else None,
    }

@router.get("/jobs/")
def list_jobs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    jobs = db.query(Job).filter(Job.user_id == current_user.id).order_by(Job.created_at.desc()).all()
    return [
        {
            "id": j.id,
            "title": j.title,
            "company": j.company,
            "salary": j.salary,
            "city": j.city,
            "platform": j.platform,
            "jd_text": j.jd_text,
            "match_score": j.match_score if j.match_score else None,
            "rating": j.rating if j.rating else None,
            "status": j.status,
            "jd_url": j.jd_url,
            "created_at": j.created_at.isoformat() if isinstance(j.created_at, datetime) else str(j.created_at),
        }
        for j in jobs
    ]

@router.post("/jobs/{job_id}/favorite")
def toggle_favorite(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        return {"error": "Job not found"}

    existing = (
        db.query(JobFavorite)
        .filter(JobFavorite.user_id == current_user.id, JobFavorite.job_id == job_id)
        .first()
    )

    if existing:
        db.delete(existing)
        db.commit()
        return {"favorited": False, "message": "已取消收藏"}
    else:
        fav = JobFavorite(user_id=current_user.id, job_id=job_id)
        db.add(fav)
        db.commit()
        return {"favorited": True, "message": "已收藏"}
