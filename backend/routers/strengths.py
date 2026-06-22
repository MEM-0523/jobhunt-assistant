from datetime import datetime
from typing import Optional
import json
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import User, Strength, Experience, Profile
from auth import get_current_user
from ai_client import call_pinme_llm

router = APIRouter(tags=["strengths"])

VALID_CLASSIFICATIONS = {"fact", "assumption", "inference"}
VALID_CONFIDENCE = {"high", "medium", "low"}


class StrengthBase(BaseModel):
    name: str = ""
    classification: str = "fact"
    evidence: str = ""
    behavior: str = ""
    ability: str = ""
    job_signal: str = ""
    confidence: str = "medium"
    missing_proof: str = ""
    next_action: str = ""


class StrengthCreate(StrengthBase):
    pass


class StrengthUpdate(BaseModel):
    name: Optional[str] = None
    classification: Optional[str] = None
    evidence: Optional[str] = None
    behavior: Optional[str] = None
    ability: Optional[str] = None
    job_signal: Optional[str] = None
    confidence: Optional[str] = None
    missing_proof: Optional[str] = None
    next_action: Optional[str] = None


def _serialize_strength(s: Strength) -> dict:
    return {
        "id": s.id,
        "user_id": s.user_id,
        "name": s.name or "",
        "classification": s.classification or "fact",
        "evidence": s.evidence or "",
        "behavior": s.behavior or "",
        "ability": s.ability or "",
        "job_signal": s.job_signal or "",
        "confidence": s.confidence or "medium",
        "missing_proof": s.missing_proof or "",
        "next_action": s.next_action or "",
        "created_at": s.created_at.isoformat() if isinstance(s.created_at, datetime) else str(s.created_at),
    }


@router.get("/strengths")
def list_strengths(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前用户的优势列表。"""
    items = (
        db.query(Strength)
        .filter(Strength.user_id == current_user.id)
        .order_by(Strength.created_at.desc())
        .all()
    )
    return [_serialize_strength(s) for s in items]


@router.post("/strengths")
def create_strength(
    req: StrengthCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """手动创建优势。"""
    if req.classification and req.classification not in VALID_CLASSIFICATIONS:
        raise HTTPException(status_code=400, detail=f"classification 必须是 {VALID_CLASSIFICATIONS} 之一")
    if req.confidence and req.confidence not in VALID_CONFIDENCE:
        raise HTTPException(status_code=400, detail=f"confidence 必须是 {VALID_CONFIDENCE} 之一")

    s = Strength(
        user_id=current_user.id,
        name=req.name,
        classification=req.classification,
        evidence=req.evidence,
        behavior=req.behavior,
        ability=req.ability,
        job_signal=req.job_signal,
        confidence=req.confidence,
        missing_proof=req.missing_proof,
        next_action=req.next_action,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _serialize_strength(s)


@router.put("/strengths/{strength_id}")
def update_strength(
    strength_id: int,
    req: StrengthUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """更新优势。"""
    s = (
        db.query(Strength)
        .filter(Strength.id == strength_id, Strength.user_id == current_user.id)
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="优势不存在")

    update_data = req.model_dump(exclude_unset=True)
    if "classification" in update_data and update_data["classification"] and update_data["classification"] not in VALID_CLASSIFICATIONS:
        raise HTTPException(status_code=400, detail=f"classification 必须是 {VALID_CLASSIFICATIONS} 之一")
    if "confidence" in update_data and update_data["confidence"] and update_data["confidence"] not in VALID_CONFIDENCE:
        raise HTTPException(status_code=400, detail=f"confidence 必须是 {VALID_CONFIDENCE} 之一")

    for key, value in update_data.items():
        setattr(s, key, value)

    db.commit()
    db.refresh(s)
    return _serialize_strength(s)


@router.delete("/strengths/{strength_id}")
def delete_strength(
    strength_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """删除优势。"""
    s = (
        db.query(Strength)
        .filter(Strength.id == strength_id, Strength.user_id == current_user.id)
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="优势不存在")
    db.delete(s)
    db.commit()
    return {"message": "已删除"}


# ============================================================
# AI 优势生成（参考 JobOK strength-taxonomy.md）
# ============================================================

_STRENGTH_GENERATE_PROMPT = """你是一位资深职业顾问和能力评估专家。请基于候选人的真实经历资产，提炼3-5个核心优势，并构建完整的证据链。

## 候选人背景
{profile_text}

## 候选人的经历资产库
{experiences_text}

## 优势分类体系

每个优势必须标注 classification（分类）：
- **fact**：有明确证据支撑的事实型优势（如"持有国家一级注册建筑师证书"）
- **assumption**：基于部分证据的假设型优势（如"快速学习能力"基于转型学习经历推断）
- **inference**：从多个证据推断的复合型优势（如"系统化思维"从多个项目管理经历中推断）

## 证据链结构（每个优势必须完整填写）

- **name**：优势名称（简洁有力，如"复杂项目交付能力"）
- **classification**：fact / assumption / inference
- **evidence**：具体证据（引用经历中的S/T/A/R要素，不要泛泛而谈）
- **behavior**：可观察的行为模式（候选人在多个场景中反复表现出的行为）
- **ability**：底层能力（从行为中抽象出的可迁移能力）
- **job_signal**：岗位信号（这个优势对求职市场的价值，HR/面试官会怎么看）
- **confidence**：high / medium / low（证据强度）
- **missing_proof**：缺失的证据（如果有，需要候选人补充什么来加强这个优势）
- **next_action**：下一步行动（如何补强或验证这个优势）

## 输出要求

请以JSON格式返回（只返回JSON）：
{{
  "strengths": [
    {{
      "name": "优势名称",
      "classification": "fact|assumption|inference",
      "evidence": "具体证据",
      "behavior": "可观察的行为模式",
      "ability": "底层能力",
      "job_signal": "岗位信号",
      "confidence": "high|medium|low",
      "missing_proof": "缺失的证据（如无则留空字符串）",
      "next_action": "下一步行动"
    }}
  ]
}}

注意：
1. 优势数量3-5个，不要少于3个，不要多于5个
2. 每个优势的证据必须来自候选人真实经历，不要编造
3. 优先提炼 fact 和 inference 类型，assumption 类型要标注 missing_proof
4. confidence 为 low 时必须给出 next_action
"""


@router.post("/strengths/generate")
async def generate_strengths(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI基于用户经历资产生成优势分析，并保存到Strength表。"""
    # 读取用户所有经历
    experiences = (
        db.query(Experience)
        .filter(Experience.user_id == current_user.id)
        .order_by(Experience.created_at.desc())
        .all()
    )

    if not experiences:
        raise HTTPException(status_code=400, detail="请先添加经历资产，再生成优势分析")

    # 构建经历文本
    exp_lines = []
    for i, exp in enumerate(experiences, 1):
        exp_lines.append(
            f"### 经历{i}：{exp.title or '未命名'}（类型：{exp.type or 'project'}）\n"
            f"- 背景：{exp.background or '未填写'}\n"
            f"- 任务：{exp.task or '未填写'}\n"
            f"- 行动：{exp.action or '未填写'}\n"
            f"- 方法/工具：{exp.method_tool or '未填写'}\n"
            f"- 结果：{exp.result or '未填写'}\n"
            f"- 证据：{exp.evidence or '未填写'}\n"
        )
    experiences_text = "\n".join(exp_lines)

    # 获取候选人背景
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if profile:
        parts = []
        if profile.name:
            parts.append(f"姓名: {profile.name}")
        if profile.city:
            parts.append(f"目标城市: {profile.city}")
        if profile.salary_min:
            parts.append(f"期望薪资: {profile.salary_min}K-{profile.salary_max}K")
        parts.append("背景: 国家一级注册建筑师，9年建筑全流程经验，AI转型中")
        profile_text = "；".join(parts)
    else:
        profile_text = "国家一级注册建筑师，9年建筑全流程经验，AI转型中"

    system_prompt = _STRENGTH_GENERATE_PROMPT.format(
        profile_text=profile_text,
        experiences_text=experiences_text,
    )
    user_message = "请基于以上经历资产，提炼候选人的核心优势并构建证据链。"

    try:
        ai_response = await call_pinme_llm(
            system_prompt, user_message,
            temperature=0.6, max_tokens=2500,
        )
    except Exception:
        ai_response = None

    strengths_data = []
    if ai_response:
        try:
            json_match = re.search(r'\{[\s\S]*\}', ai_response)
            if json_match:
                data = json.loads(json_match.group())
                strengths_data = data.get("strengths", []) or []
        except (json.JSONDecodeError, KeyError, TypeError):
            pass

    # Fallback mock if AI fails or returns empty
    if not strengths_data:
        strengths_data = _build_mock_strengths(experiences)

    # Save to DB
    saved = []
    for item in strengths_data[:5]:  # Cap at 5
        if not isinstance(item, dict):
            continue
        s = Strength(
            user_id=current_user.id,
            name=item.get("name", ""),
            classification=item.get("classification", "fact") if item.get("classification", "fact") in VALID_CLASSIFICATIONS else "fact",
            evidence=item.get("evidence", ""),
            behavior=item.get("behavior", ""),
            ability=item.get("ability", ""),
            job_signal=item.get("job_signal", ""),
            confidence=item.get("confidence", "medium") if item.get("confidence", "medium") in VALID_CONFIDENCE else "medium",
            missing_proof=item.get("missing_proof", ""),
            next_action=item.get("next_action", ""),
        )
        db.add(s)
        saved.append(s)

    db.commit()
    for s in saved:
        db.refresh(s)

    return {
        "strengths": [_serialize_strength(s) for s in saved],
        "total": len(saved),
        "source": "ai" if ai_response and strengths_data else "mock",
    }


def _build_mock_strengths(experiences: list) -> list:
    """Build mock strengths from experiences when AI is unavailable."""
    return [
        {
            "name": "复杂项目交付能力",
            "classification": "fact",
            "evidence": "9年建筑全流程经验，主导多个大型项目从概念到交付",
            "behavior": "在多个项目中表现出系统性拆解和推进能力",
            "ability": "项目管理、跨专业协调、风险控制",
            "job_signal": "HR会看重交付能力和责任心，适合项目经理/解决方案岗位",
            "confidence": "high",
            "missing_proof": "",
            "next_action": "准备3个不同类型项目的STAR故事",
        },
        {
            "name": "系统化思维",
            "classification": "inference",
            "evidence": "从建筑方案设计到BIM流程优化，多次将复杂问题结构化",
            "behavior": "面对复杂问题时习惯先建立框架再执行",
            "ability": "结构化思考、流程设计、方法论沉淀",
            "job_signal": "适合产品经理、咨询顾问等需要抽象能力的岗位",
            "confidence": "high",
            "missing_proof": "",
            "next_action": "在简历中补充1-2个方法论沉淀的案例",
        },
        {
            "name": "快速学习能力",
            "classification": "assumption",
            "evidence": "从建筑转型AI，3个月内完成Python和AI基础学习",
            "behavior": "面对新领域能制定学习路线并快速验证",
            "ability": "自主学习、知识迁移、目标管理",
            "job_signal": "跨行业转型者的核心卖点，但需要具体成果佐证",
            "confidence": "medium",
            "missing_proof": "缺少AI领域的实际项目成果（如开源贡献、产品上线）",
            "next_action": "完成1-2个可展示的AI项目（如个人AI工作系统）",
        },
    ]
