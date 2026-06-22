from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import User, Profile
from auth import get_current_user
from ai_client import call_pinme_llm
import json
import os
import re

router = APIRouter(prefix="/career", tags=["career"])

_SKILL_MAPPING_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "skill_mapping.json")


class TransitionRequest(BaseModel):
    current_industry: str = ""
    current_role: str = ""
    target_industry: str = ""
    target_role: str = ""


class PersonalizedTransitionRequest(BaseModel):
    current_industry: str = ""
    current_role: str = ""
    target_industry: str = ""
    target_role: str = ""
    risk_tolerance: str = "medium"  # low/medium/high
    learning_pace: str = "part-time"  # full-time/part-time/intensive
    target_timeline: str = "6months"  # 3months/6months/12months


# ============================================================
# Layer 1: Knowledge Base Loader
# ============================================================

def _load_skill_mapping() -> dict:
    try:
        with open(_SKILL_MAPPING_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"occupations": {}, "transition_strategies": {}}


def _fuzzy_match_role(user_role: str, occupations: dict) -> Optional[str]:
    """Fuzzy match user's role to an occupation key in the knowledge base."""
    user_role_lower = user_role.lower()
    # Exact match
    if user_role in occupations:
        return user_role
    # Partial match
    for key in occupations:
        key_lower = key.lower()
        if user_role_lower in key_lower or key_lower in user_role_lower:
            return key
    # Keyword overlap match
    for key in occupations:
        key_words = set(key.replace("/", " ").split())
        role_words = set(user_role_lower.replace("/", " ").replace("、", " ").split())
        if len(key_words & role_words) >= 2:
            return key
    return None


def _calculate_transition_score(user_role_occupation: dict, transition: dict, user_profile=None) -> dict:
    """Calculate a personalized transition score based on user profile parameters."""
    base_score = transition.get("overlap_score", 0.5)

    # Adjust by risk tolerance
    risk = user_profile.risk_tolerance if user_profile else "medium"
    risk_factors = {"low": 0.0, "medium": -0.05, "high": -0.1}
    risk_adjustment = risk_factors.get(risk, 0.0)

    # Adjust by industry preference
    industry_bonus = 0.0
    if user_profile and user_profile.target_industries:
        to_industry = transition.get("to_industry", "")
        for target in user_profile.target_industries:
            if target in to_industry or to_industry in target:
                industry_bonus = 0.1
                break

    # Gap severity adjustment (more high-severity gaps = lower score for risk-averse)
    gaps = transition.get("gaps", [])
    high_gap_count = sum(1 for g in gaps if g.get("severity") == "high")
    gap_penalty = high_gap_count * 0.03 if risk == "low" else high_gap_count * 0.01

    adjusted_score = min(1.0, max(0.0, base_score + risk_adjustment + industry_bonus - gap_penalty))
    return {
        "base_score": base_score,
        "adjusted_score": round(adjusted_score, 2),
        "adjustments": {
            "risk_tolerance": risk_adjustment,
            "industry_preference": industry_bonus,
            "gap_penalty": round(gap_penalty, 2),
        }
    }


def _estimate_timeline(transition: dict, user_profile) -> dict:
    """Estimate learning timeline based on gaps and user's learning pace."""
    mapping = _load_skill_mapping()
    strategies = mapping.get("transition_strategies", {})
    paces = strategies.get("learning_paces", {})
    risk_levels = strategies.get("risk_levels", {})

    pace = user_profile.learning_pace if user_profile else "part-time"
    risk = user_profile.risk_tolerance if user_profile else "medium"
    target_timeline = user_profile.target_timeline if user_profile else "6months"

    pace_config = paces.get(pace, paces.get("part-time", {"daily_hours": 2.5}))
    risk_config = risk_levels.get(risk, risk_levels.get("medium", {"timeline_factor": 1.0}))

    daily_hours = pace_config.get("daily_hours", 2.5)
    timeline_factor = risk_config.get("timeline_factor", 1.0)

    # Calculate total study hours needed
    gaps = transition.get("gaps", [])
    total_hours = sum(g.get("estimated_hours", 20) for g in gaps)

    # Calculate days needed
    days_needed = total_hours / daily_hours if daily_hours > 0 else total_hours / 2.5
    weeks_needed = days_needed * timeline_factor / 7

    # Map to target timeline labels
    timeline_labels = {
        "3months": 12,
        "6months": 24,
        "12months": 48,
    }
    max_weeks = timeline_labels.get(target_timeline, 24)

    # Phase breakdown
    phases = []
    remaining_hours = total_hours
    phase_num = 1
    phase_weeks = min(4, max_weeks // 3)
    sorted_gaps = sorted(gaps, key=lambda g: g.get("severity", "medium"), reverse=True)

    for gap in sorted_gaps:
        gap_hours = gap.get("estimated_hours", 20)
        phases.append({
            "phase": phase_num,
            "name": gap.get("gap", f"Phase {phase_num}"),
            "hours": gap_hours,
            "weeks": round(gap_hours / (daily_hours * 7), 1),
            "suggestion": gap.get("suggestion", ""),
            "severity": gap.get("severity", "medium"),
        })
        remaining_hours -= gap_hours
        phase_num += 1

    feasible = days_needed <= max_weeks * 7

    return {
        "total_hours": total_hours,
        "daily_hours": daily_hours,
        "estimated_weeks": round(weeks_needed, 1),
        "timeline_feasible": feasible,
        "timeline_factor": timeline_factor,
        "risk_strategy": risk_config.get("label", "平衡型"),
        "learning_pace_label": pace_config.get("label", "在职学习"),
        "phases": phases,
        "message": f"按{pace_config.get('label', '在职学习')}节奏，{risk_config.get('label', '平衡型')}策略，预计{round(weeks_needed, 1)}周完成" if feasible else f"在{target_timeline}内完成较紧张，建议调整学习节奏或延长时间线",
    }


# ============================================================
# Layer 2: Knowledge Base Matching (no AI)
# ============================================================

@router.post("/analyze-transition")
def analyze_transition(
    req: TransitionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Knowledge-base-only matching. Fast, no AI cost."""
    mapping = _load_skill_mapping()
    occupations = mapping.get("occupations", {})

    # Get user profile for personalization
    user_profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    # Fuzzy match user's role
    matched_role = _fuzzy_match_role(req.current_role, occupations)
    if not matched_role:
        return _generic_transition_response(req, user_profile)

    occupation = occupations[matched_role]

    # Find matching transitions
    transitions = occupation.get("typical_transitions", [])
    matched_transitions = []

    for t in transitions:
        to_role_match = not req.target_role or req.target_role in t["to"] or t["to"] in req.target_role
        to_industry_match = not req.target_industry or req.target_industry in t["to_industry"] or t["to_industry"] in req.target_industry

        if to_role_match or to_industry_match:
            score = _calculate_transition_score(occupation, t, user_profile)
            matched_transitions.append({
                "transition": t,
                "score": score,
            })

    # If no specific match, return all possible transitions sorted by score
    if not matched_transitions:
        for t in transitions:
            score = _calculate_transition_score(occupation, t, user_profile)
            matched_transitions.append({
                "transition": t,
                "score": score,
            })

    # Sort by adjusted score
    matched_transitions.sort(key=lambda x: x["score"]["adjusted_score"], reverse=True)

    best = matched_transitions[0] if matched_transitions else None
    t = best["transition"] if best else None

    if not t:
        return _generic_transition_response(req, user_profile)

    timeline = _estimate_timeline(t, user_profile)

    return {
        "matched": True,
        "data_source": "knowledge_base",
        "from_industry": matched_role,
        "from_role": req.current_role or matched_role,
        "core_skills": occupation.get("core_skills", []),
        "all_paths": [
            {
                "to": m["transition"]["to"],
                "to_industry": m["transition"]["to_industry"],
                "overlap_score": m["transition"]["overlap_score"],
                "adjusted_score": m["score"]["adjusted_score"],
                "adjustments": m["score"]["adjustments"],
                "archetypes": m["transition"].get("recommended_archetypes", []),
            }
            for m in matched_transitions
        ],
        "best_path": {
            "to": t["to"],
            "to_industry": t["to_industry"],
            "overlap_score": t["overlap_score"],
            "overlap_skills": t.get("overlap_skills", []),
            "gaps": t.get("gaps", []),
            "archetypes": t.get("recommended_archetypes", []),
        },
        "timeline": timeline,
    }


# ============================================================
# Layer 3: AI-Powered Personalized Adaptation
# ============================================================

_PERSONALIZATION_PROMPT = """你是一个专业的职业转型顾问。请根据用户画像和知识库匹配结果，生成个性化的转型路径建议。

## 用户画像
- 当前行业/角色：{current_role}
- 风险偏好：{risk_label}（{risk_desc}）
- 学习节奏：{pace_label}（{pace_desc}）
- 目标时间线：{target_timeline}
- 目标行业：{target_industries}

## 知识库匹配结果
- 最佳转型路径：{best_path}
- 可迁移技能：{overlap_skills}
- 技能差距：{gaps}
- 建议原型：{archetypes}

## 所有可选路径（按匹配度排序）
{all_paths}

## 输出要求
请以JSON格式返回个性化建议：

{{
  "personalized_strategy": "300字以内的个性化转型策略，说明：为什么选这条路径、风险偏好如何影响策略、学习节奏如何调整",
  "milestones": [
    {{"phase": 1, "name": "阶段名称", "duration": "预计周数", "actions": ["具体行动1", "具体行动2"], "checkpoint": "验收标准"}}
  ],
  "risk_mitigation": [
    {{"risk": "风险描述", "likelihood": "high/medium/low", "mitigation": "化解策略"}}
  ],
  "quick_wins": ["3-5个可以本周开始的具体行动"],
  "alternative_paths": [
    {{"path": "备选路径名称", "when_to_consider": "什么情况下考虑这条路径", "trade_off": "利弊分析"}}
  ],
  "resources": [
    {{"name": "学习资源名称", "type": "课程/书籍/项目/社区", "why": "推荐理由", "priority": "high/medium/low"}}
  ]
}}"""


@router.post("/analyze-transition-ai")
async def analyze_transition_ai(
    req: PersonalizedTransitionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI-powered personalized transition analysis. Calls Pinme LLM for dynamic adaptation."""
    mapping = _load_skill_mapping()
    occupations = mapping.get("occupations", {})
    strategies = mapping.get("transition_strategies", {})

    user_profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    # Save user preferences to profile if provided
    if user_profile:
        updated = False
        if req.risk_tolerance and req.risk_tolerance != user_profile.risk_tolerance:
            user_profile.risk_tolerance = req.risk_tolerance
            updated = True
        if req.learning_pace and req.learning_pace != user_profile.learning_pace:
            user_profile.learning_pace = req.learning_pace
            updated = True
        if req.target_timeline and req.target_timeline != user_profile.target_timeline:
            user_profile.target_timeline = req.target_timeline
            updated = True
        if updated:
            db.commit()

    # Step 1: Knowledge base matching (same as analyze-transition)
    matched_role = _fuzzy_match_role(req.current_role, occupations)
    if not matched_role:
        return _generic_transition_response(req, user_profile)

    occupation = occupations[matched_role]
    transitions = occupation.get("typical_transitions", [])

    matched_transitions = []
    for t in transitions:
        to_role_match = not req.target_role or req.target_role in t["to"] or t["to"] in req.target_role
        to_industry_match = not req.target_industry or req.target_industry in t["to_industry"] or t["to_industry"] in req.target_industry
        if to_role_match or to_industry_match or not req.target_role:
            score = _calculate_transition_score(occupation, t, user_profile)
            matched_transitions.append({
                "transition": t,
                "score": score,
            })

    if not matched_transitions:
        for t in transitions:
            score = _calculate_transition_score(occupation, t, user_profile)
            matched_transitions.append({"transition": t, "score": score})

    matched_transitions.sort(key=lambda x: x["score"]["adjusted_score"], reverse=True)
    best = matched_transitions[0] if matched_transitions else None
    t = best["transition"] if best else None

    if not t:
        return _generic_transition_response(req, user_profile)

    # Step 2: Build AI prompt with user context
    risk_levels = strategies.get("risk_levels", {})
    paces = strategies.get("learning_paces", {})
    risk_config = risk_levels.get(req.risk_tolerance, risk_levels.get("medium", {}))
    pace_config = paces.get(req.learning_pace, paces.get("part-time", {}))

    all_paths_text = "\n".join([
        f"- {m['transition']['to']} ({m['transition']['to_industry']}): 匹配度{m['score']['adjusted_score']}"
        for m in matched_transitions[:5]
    ])

    system_prompt = _PERSONALIZATION_PROMPT.format(
        current_role=f"{req.current_industry} / {req.current_role}",
        risk_label=risk_config.get("label", "平衡型"),
        risk_desc=risk_config.get("description", ""),
        pace_label=pace_config.get("label", "在职学习"),
        pace_desc=pace_config.get("description", ""),
        target_timeline=req.target_timeline,
        target_industries=req.target_industry or "未指定",
        best_path=f"{t['to']} ({t['to_industry']})",
        overlap_skills=", ".join(t.get("overlap_skills", [])),
        gaps=json.dumps(t.get("gaps", []), ensure_ascii=False),
        archetypes=json.dumps(t.get("recommended_archetypes", []), ensure_ascii=False),
        all_paths=all_paths_text,
    )

    user_message = f"请根据我的情况（{req.current_role} → {req.target_role or t['to']}），生成个性化的转型路径建议。"

    # Step 3: Call AI
    ai_response = await call_pinme_llm(system_prompt, user_message, temperature=0.7, max_tokens=3000)

    # Step 4: Build base response with knowledge base data
    timeline = _estimate_timeline(t, user_profile)
    base_response = {
        "matched": True,
        "data_source": "ai_personalized" if ai_response else "knowledge_base",
        "from_industry": matched_role,
        "from_role": req.current_role or matched_role,
        "core_skills": occupation.get("core_skills", []),
        "all_paths": [
            {
                "to": m["transition"]["to"],
                "to_industry": m["transition"]["to_industry"],
                "overlap_score": m["transition"]["overlap_score"],
                "adjusted_score": m["score"]["adjusted_score"],
                "adjustments": m["score"]["adjustments"],
                "archetypes": m["transition"].get("recommended_archetypes", []),
            }
            for m in matched_transitions
        ],
        "best_path": {
            "to": t["to"],
            "to_industry": t["to_industry"],
            "overlap_score": t["overlap_score"],
            "overlap_skills": t.get("overlap_skills", []),
            "gaps": t.get("gaps", []),
            "archetypes": t.get("recommended_archetypes", []),
        },
        "timeline": timeline,
    }

    # Step 5: Merge AI personalization
    if ai_response:
        try:
            json_match = re.search(r'\{[\s\S]*\}', ai_response)
            if json_match:
                ai_data = json.loads(json_match.group())
                base_response["ai_personalization"] = ai_data
                base_response["data_source"] = "ai_personalized"
        except (json.JSONDecodeError, KeyError):
            pass

    return base_response


# ============================================================
# Generic fallback response
# ============================================================

def _generic_transition_response(req, user_profile=None) -> dict:
    return {
        "matched": False,
        "data_source": "generic",
        "message": "该转型路径暂未收录，正在扩展中。以下为通用建议。",
        "transferable_skills": [
            {"skill": "行业专业知识", "level": "精通", "reason": "任何资深专业人士都具备的领域知识"},
            {"skill": "项目管理", "level": "熟练", "reason": "大多数专业工作都包含项目管理"},
            {"skill": "沟通协作", "level": "熟练", "reason": "跨团队协作是通用能力"},
            {"skill": "学习能力", "level": "精通", "reason": "转型本身就证明了学习能力"}
        ],
        "skill_gaps": [
            {"gap": "目标行业知识", "severity": "high", "suggestion": "通过阅读行业报告和关注行业KOL快速建立认知", "estimated_hours": 40},
            {"gap": "目标岗位技能", "severity": "high", "suggestion": "找3个目标岗位JD，逐一对照学习", "estimated_hours": 30}
        ],
        "recommended_archetypes": [],
        "all_paths": [],
    }


# ============================================================
# Utility: Get occupation list for frontend dropdowns
# ============================================================

@router.get("/occupations")
def list_occupations():
    """List all occupations in the knowledge base for frontend dropdowns."""
    mapping = _load_skill_mapping()
    occupations = mapping.get("occupations", {})
    result = []
    for name, data in occupations.items():
        transitions = data.get("typical_transitions", [])
        result.append({
            "name": name,
            "skill_count": len(data.get("core_skills", [])),
            "transition_count": len(transitions),
            "available_transitions": [t["to"] for t in transitions],
        })
    return {"occupations": result}


@router.get("/strategies")
def list_strategies():
    """List available risk levels and learning paces."""
    mapping = _load_skill_mapping()
    return {"strategies": mapping.get("transition_strategies", {})}