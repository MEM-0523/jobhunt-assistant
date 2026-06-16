from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models import User
import json
import os

router = APIRouter(prefix="/career", tags=["career"])

_SKILL_MAPPING_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "skill_mapping.json")


class TransitionRequest(BaseModel):
    current_industry: str = ""
    current_role: str = ""
    target_industry: str = ""
    target_role: str = ""


def _load_skill_mapping():
    try:
        with open(_SKILL_MAPPING_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"transitions": []}


@router.post("/analyze-transition")
def analyze_transition(
    req: TransitionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mapping = _load_skill_mapping()

    matched = None
    for t in mapping.get("transitions", []):
        if (t["from_industry"] == req.current_industry and
            t["from_role"] == req.current_role and
            t.get("to_industry", "") == req.target_industry and
            t.get("to_role", "") == req.target_role):
            matched = t
            break

    if not matched:
        for t in mapping.get("transitions", []):
            if req.current_industry and t["from_industry"] in req.current_industry:
                matched = t
                break

    if not matched:
        return {
            "matched": False,
            "message": "该转型路径暂未收录，正在扩展中。以下为通用建议。",
            "transferable_skills": [
                {"skill": "行业专业知识", "level": "精通", "reason": "任何资深专业人士都具备的领域知识"},
                {"skill": "项目管理", "level": "熟练", "reason": "大多数专业工作都包含项目管理"},
                {"skill": "沟通协作", "level": "熟练", "reason": "跨团队协作是通用能力"},
                {"skill": "学习能力", "level": "精通", "reason": "转型本身就证明了学习能力"}
            ],
            "skill_gaps": [
                {"gap": "目标行业知识", "severity": "high", "suggestion": "通过阅读行业报告和关注行业KOL快速建立认知"},
                {"gap": "目标岗位技能", "severity": "high", "suggestion": "找3个目标岗位JD，逐一对照学习"}
            ],
            "recommended_archetypes": [],
            "data_source": "generic"
        }

    return {
        "matched": True,
        "from_industry": matched["from_industry"],
        "from_role": matched["from_role"],
        "to_industry": matched["to_industry"],
        "to_role": matched["to_role"],
        "transferable_skills": matched["transferable_skills"],
        "skill_gaps": matched["skill_gaps"],
        "recommended_archetypes": matched.get("recommended_archetypes", []),
        "data_source": "knowledge_base"
    }