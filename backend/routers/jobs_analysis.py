import re
import json
from typing import Optional
from fastapi import APIRouter, Depends, Body, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import User, Job, Profile
from auth import get_current_user
from ai_client import call_pinme_llm

from .jobs_data import MOCK_JOBS

router = APIRouter(tags=["jobs"])




DIMENSIONS_CONFIG = [
    {"name": "职责匹配度", "en_key": "responsibility_match", "weight": 15},
    {"name": "技能匹配度", "en_key": "skill_match", "weight": 15},
    {"name": "薪资竞争力", "en_key": "salary_competitiveness", "weight": 12},
    {"name": "成长空间", "en_key": "growth_potential", "weight": 12},
    {"name": "稳定性", "en_key": "stability", "weight": 10},
    {"name": "学习价值", "en_key": "learning_value", "weight": 10},
    {"name": "家庭平衡", "en_key": "work_life_balance", "weight": 8},
    {"name": "意义感", "en_key": "meaning", "weight": 6},
    {"name": "工作自由度", "en_key": "autonomy", "weight": 6},
    {"name": "创造性", "en_key": "creativity", "weight": 6},
]


def _get_rating(score: float) -> str:
    if score >= 4.5:
        return "A"
    elif score >= 4.0:
        return "B"
    elif score >= 3.5:
        return "C"
    elif score >= 3.0:
        return "D"
    return "F"


def _generate_mock_dimensions(overall_score: float) -> list[dict]:
    """Generate lightweight mock dimensions based on overall score, for fallback when AI omits dimensions."""
    import random
    rng = random.Random(int(overall_score * 100))
    base = overall_score / 20.0  # normalize 0-100 → 0-5
    dims = [
        ("职责匹配度", 15), ("技能匹配度", 15), ("薪资竞争力", 12),
        ("成长空间", 12), ("稳定性", 10), ("学习价值", 10),
        ("家庭平衡", 8), ("意义感", 6), ("工作自由度", 6), ("创造性", 6),
    ]
    result = []
    for name, weight in dims:
        score = round(min(5.0, max(2.0, base + rng.uniform(-0.5, 0.5))), 1)
        result.append({"name": name, "score": score, "weight": weight, "description": "基于综合评分估算"})
    return result


def _generate_mock_analysis(job: Job) -> dict:
    """Generate realistic mock analysis data based on job content."""
    import random

    # Seed RNG with job id for consistent results per job
    rng = random.Random(job.id * 7 + 13)

    jd_lower = job.jd_text.lower()

    # Adjust dimension scores based on JD keywords
    is_ai = any(kw in jd_lower for kw in ["ai", "人工智能", "大模型", "机器学习"])
    is_product = any(kw in jd_lower for kw in ["产品", "需求", "规划"])
    is_tech = any(kw in jd_lower for kw in ["开发", "python", "后端", "全栈", "算法"])
    is_management = any(kw in jd_lower for kw in ["总监", "管理", "团队", "合伙人"])
    is_remote = any(kw in jd_lower for kw in ["远程"])
    is_startup = any(kw in jd_lower for kw in ["创业", "从0到1", "合伙人"])

    # Parse salary min
    salary_min = parse_salary_min(job.salary)

    # Base scores with noise, then adjust
    base_score = rng.uniform(3.2, 4.5)

    responsibility = min(5.0, max(2.0, base_score + rng.uniform(-0.3, 0.8)))
    skill = min(5.0, max(2.0, base_score + rng.uniform(-0.5, 0.4)))
    salary_comp = min(5.0, max(2.0, 3.5 if salary_min >= 25 else 3.0))
    growth = min(5.0, max(2.0, base_score + (0.5 if is_ai else 0.0) + rng.uniform(-0.2, 0.5)))
    stability = min(5.0, max(1.5, 3.0 if is_startup else 4.0 - rng.uniform(0, 0.5)))
    learning = min(5.0, max(2.0, base_score + (0.5 if is_ai or is_tech else 0.0) + rng.uniform(-0.3, 0.3)))
    wlb = min(5.0, max(2.5, 4.0 if is_remote else 3.5 + rng.uniform(-0.3, 0.3)))
    meaning = min(5.0, max(2.5, base_score + rng.uniform(-0.4, 0.4)))
    autonomy = min(5.0, max(2.5, 4.0 if is_management else 3.5 + rng.uniform(-0.3, 0.5)))
    creativity = min(5.0, max(2.0, base_score + (0.3 if is_product else 0.0) + rng.uniform(-0.3, 0.4)))

    dimensions = [
        {"name": "职责匹配度", "score": round(responsibility, 1), "weight": 15,
         "description": "你的建筑项目管理经验与AI产品职责高度相关" if is_product else "职责要求与你的能力背景匹配度较好"},
        {"name": "技能匹配度", "score": round(skill, 1), "weight": 15,
         "description": "部分AI技能需补足，但核心能力匹配" if is_ai else "技术栈与你的技能体系有交集"},
        {"name": "薪资竞争力", "score": round(salary_comp, 1), "weight": 12,
         "description": "薪资在目标范围内" if salary_min >= 25 else "薪资偏低，需关注成长空间"},
        {"name": "成长空间", "score": round(growth, 1), "weight": 12,
         "description": "AI行业成长空间大" if is_ai else "有一定成长空间"},
        {"name": "稳定性", "score": round(stability, 1), "weight": 10,
         "description": "创业公司有一定风险" if is_startup else "公司发展稳定"},
        {"name": "学习价值", "score": round(learning, 1), "weight": 10,
         "description": "AI赛道学习机会多" if is_ai else "能学到新领域知识"},
        {"name": "家庭平衡", "score": round(wlb, 1), "weight": 8,
         "description": "远程办公更灵活" if is_remote else "工作时间较为合理"},
        {"name": "意义感", "score": round(meaning, 1), "weight": 6,
         "description": "产品有社会价值" if is_product else "工作有一定意义感"},
        {"name": "工作自由度", "score": round(autonomy, 1), "weight": 6,
         "description": "管理岗位有较高自主权" if is_management else "有一定自主权"},
        {"name": "创造性", "score": round(creativity, 1), "weight": 6,
         "description": "产品设计创意空间大" if is_product else "工作中有发挥创意的机会"},
    ]

    # Calculate weighted average
    overall_score = sum(d["score"] * d["weight"] for d in dimensions) / 100.0
    overall_score = round(overall_score, 1)
    rating = _get_rating(overall_score)

    # Generate summary and suggestions based on rating
    if rating in ("A", "B"):
        summary = f"该岗位与你的能力匹配度较高（整体评分{overall_score}），{'AI方向与你的建筑+AI复合背景契合' if is_ai else '岗位方向与你的职业规划一致'}。建议优先投递。"
        suggestions = [
            "面试时重点展示建筑项目管理到目标岗位的迁移能力",
            "准备1-2个相关领域的实际案例",
            "了解该公司产品和竞品情况",
        ]
    elif rating == "C":
        summary = f"该岗位匹配度中等（整体评分{overall_score}），可以作为备选方向。建议进一步了解公司和团队情况后再决定是否投递。"
        suggestions = [
            "确认薪资是否能满足期望",
            "了解团队规模和公司发展现状",
            "评估该岗位的长期发展路径",
        ]
    else:
        summary = f"该岗位整体匹配度偏低（整体评分{overall_score}），不建议优先投递。但如果岗位有特殊吸引力，可以考虑尝试。"
        suggestions = [
            "评估是否有其他更匹配的岗位可选",
            "如有特殊吸引力，可尝试投递但降低期望",
            "将该岗位作为市场调研参考",
        ]

    return {
        "overall_score": overall_score,
        "rating": rating,
        "dimensions": dimensions,
        "summary": summary,
        "suggestions": suggestions,
    }


@router.get("/jobs/{job_id}/analyze")
async def analyze_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        return {"error": "Job not found"}

    # Try real AI analysis via Pinme API
    user_profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    profile_text = ""
    if user_profile:
        parts = []
        if user_profile.name:
            parts.append(f"候选人: {user_profile.name}")
        if user_profile.city:
            parts.append(f"目标城市: {user_profile.city}")
        if user_profile.salary_min:
            parts.append(f"期望薪资: {user_profile.salary_min}K-{user_profile.salary_max}K")
        parts.append(f"背景: 国家一级注册建筑师，9年建筑全流程经验，AI转型中")
        profile_text = "；".join(parts)

    system_prompt = _OCHO_BLOCK_PROMPT.format(profile_text=profile_text)

    user_message = f"公司：{job.company}\n岗位：{job.title}\n薪资：{job.salary}\n城市：{job.city}\n\n岗位描述：{job.jd_text}"

    ai_response = await call_pinme_llm(system_prompt, user_message, temperature=0.5, max_tokens=3000)

    if ai_response:
        try:
            json_match = re.search(r'\{[\s\S]*\}', ai_response)
            if json_match:
                analysis = json.loads(json_match.group())
                if "overall_score" in analysis:
                    # Ensure dimensions field exists (AI may omit it)
                    if "dimensions" not in analysis or not analysis["dimensions"]:
                        mock = _generate_mock_analysis(job)
                        analysis["dimensions"] = mock["dimensions"]
                    job.match_score = analysis.get("overall_score", 0)
                    job.rating = analysis.get("rating", "C")
                    db.commit()
                    return analysis
        except (json.JSONDecodeError, KeyError):
            pass

    # Fallback to mock analysis
    analysis = _generate_mock_analysis(job)
    job.match_score = analysis.get("overall_score", 0)
    job.rating = analysis.get("rating")
    db.commit()
    return analysis



@router.post("/jobs/save-from-analysis")
def save_job_from_analysis(
    data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    title = data.get("title") or data.get("职位名称", "")
    company = data.get("company") or data.get("公司名称", "")
    jd_text = data.get("jd_text") or data.get("岗位描述", "")
    salary = data.get("salary") or data.get("薪资范围", "面议")
    city = data.get("city") or data.get("城市", "")
    platform = data.get("platform", "JD直推")

    if not title:
        raise HTTPException(status_code=400, detail="缺少职位名称")

    existing = db.query(Job).filter(
        Job.user_id == current_user.id,
        Job.title == title,
        Job.company == company,
    ).first()
    if existing:
        return {
            "id": existing.id,
            "message": "岗位已存在",
            "duplicate": True,
        }

    job = Job(
        user_id=current_user.id,
        title=title,
        company=company,
        salary=salary,
        city=city,
        platform=platform,
        jd_text=jd_text,
        jd_url="",
        status="saved",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return {"id": job.id, "message": "岗位已保存", "duplicate": False}


# ============================================================
# JD直推入口：粘贴JD文本直接分析（入口A）
# ============================================================

_OCHO_BLOCK_PROMPT = """你是一个专业的求职顾问AI。请严格按照以下7-Block格式对岗位进行全面评估。

候选人背景：
{profile_text}

---

## Block A：角色概述
判断该岗位属于以下哪种原型：FDE(快速交付工程师)、SA(系统架构师)、PM(产品经理)、LLMOps、Agentic(智能体工程)、Transformation(变革管理)。如果是混合型，指出最接近的2个。

表格输出：领域、职能、职级、远程情况、团队规模、一句话概述。

## Block B：技能匹配
逐行映射JD要求与候选人能力，标注匹配度（✅强/⚠️中/❌弱）。对每个差距分析：是硬性门槛还是加分项？候选人能否展示相邻经验？具体缓解方案。

## Block C：职级策略
JD检测到的职级 vs 候选人自然职级。'卖资深不撒谎'方案。如被降级如何处理。

## Block D：薪酬评估
分析薪资竞争力（基于杭州市场），给出合理期望范围。

## Block E：简历定向方案
Top 5简历修改建议，最大化匹配度。每条包含：板块、当前状态、建议修改、原因。

## Block F：面试准备
5-6个STAR+R故事，映射到JD要求。每个故事标注：S(情境)、T(任务)、A(行动)、R(结果)、Reflection(反思)。还要包括1个推荐案例研究和红旗问题应对方式。

## Block G：岗位真实性评估
分析发布信号判断是否为真实有效招聘。三级之一：高置信度/谨慎推进/可疑。

---

输出格式：JSON，包含以下字段：
- prototype（检测到的原型）
- block_a（角色概述，markdown表格文本）
- block_b（技能匹配，markdown表格文本）
- block_c（职级策略，文本）
- block_d（薪酬评估，文本）
- block_e（简历定向方案，markdown表格文本）
- block_f（面试准备，markdown文本）
- block_g（真实性评估 + 等级，文本）
- overall_score（整数0-100）
- rating（A/B/C/D/F）
- dimensions（10维度评分数组，每项含name/score/weight/description，维度：职责匹配度15%/技能匹配度15%/薪资竞争力12%/成长空间12%/稳定性10%/学习价值10%/家庭平衡8%/意义感6%/工作自由度6%/创造性6%）
- summary（一句话总评）
- suggestions（3-5条行动建议）
"""


class DirectAnalyzeRequest(BaseModel):
    jd_text: str
    company: str = ""
    title: str = ""


@router.post("/jobs/direct-analyze")
async def direct_analyze(
    req: DirectAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    profile_text = "国家一级注册建筑师，9年建筑全流程经验，AI转型中"
    if user_profile:
        parts = []
        if user_profile.name:
            parts.append(f"候选人: {user_profile.name}")
        if user_profile.city:
            parts.append(f"目标城市: {user_profile.city}")
        if user_profile.salary_min:
            parts.append(f"期望薪资: {user_profile.salary_min}K-{user_profile.salary_max}K")
        profile_text = "；".join(parts) if parts else profile_text

    system_prompt = _OCHO_BLOCK_PROMPT.format(profile_text=profile_text)
    user_message = f"公司：{req.company or '未知'}\n岗位：{req.title or '未知'}\n\n岗位描述：\n{req.jd_text}"

    ai_response = await call_pinme_llm(system_prompt, user_message, temperature=0.5, max_tokens=3000)

    if ai_response:
        try:
            json_match = re.search(r'\{[\s\S]*\}', ai_response)
            if json_match:
                analysis = json.loads(json_match.group())
                if "overall_score" in analysis:
                    # Ensure dimensions field exists (AI may omit it)
                    if "dimensions" not in analysis or not analysis["dimensions"]:
                        analysis["dimensions"] = _generate_mock_dimensions(analysis.get("overall_score", 65))
                    return analysis
        except (json.JSONDecodeError, KeyError):
            pass

    return {
        "overall_score": 65,
        "rating": "C",
        "dimensions": _generate_mock_dimensions(65),
        "summary": "AI分析暂不可用，请稍后重试",
        "suggestions": ["尝试重新分析", "手动评估岗位匹配度"],
        "block_a": "| 字段 | 内容 |\n|------|------|\n| 原型 | 待分析 |\n| 领域 | 待分析 |\n| 职能 | 待分析 |\n| 职级 | 待分析 |\n| 远程 | 待分析 |\n| 团队规模 | 待分析 |\n| 概述 | 待AI分析 |",
        "prototype": "未知",
    }
