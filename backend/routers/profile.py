from typing import Optional
import os
import yaml
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import User, Profile
from auth import get_current_user

router = APIRouter(tags=["profile"])

_PROFILE_CONFIG_PATH = "/Users/wutianya/Desktop/我的AI工作系统/01-职业转型/求职系统/config/profile.yml"


class ProfileResponse(BaseModel):
    id: int
    user_id: int
    name: str
    phone: str
    city: str
    salary_min: int
    salary_max: int
    deal_breakers: list
    preferences: dict

    class Config:
        from_attributes = True


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    deal_breakers: Optional[list] = None
    preferences: Optional[dict] = None


@router.get("/profile", response_model=ProfileResponse)
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        profile = Profile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.put("/profile", response_model=ProfileResponse)
def update_profile(
    req: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        profile = Profile(user_id=current_user.id)
        db.add(profile)

    update_data = req.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(profile, key, value)

    db.commit()
    db.refresh(profile)
    return profile


@router.get("/profile/import-from-config")
def import_profile_from_config():
    """Read profile.yml and _profile.md from 求职系统 config, return prefill data."""
    profile_data = {
        "name": "",
        "city": "杭州",
        "salary_min": 25,
        "salary_max": 35,
        "deal_breakers": ["外包公司", "强制大小周"],
        "preferences": {},
    }

    if not os.path.exists(_PROFILE_CONFIG_PATH):
        return {"data": profile_data, "source": "default"}

    try:
        with open(_PROFILE_CONFIG_PATH, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)

        candidate = config.get("candidate", {})
        profile_data["name"] = candidate.get("full_name", "")
        profile_data["city"] = candidate.get("location", "杭州")

        comp = config.get("compensation", {})
        try:
            profile_data["salary_min"] = int(comp.get("minimum", "25").replace("K", ""))
        except (ValueError, AttributeError):
            profile_data["salary_min"] = 25
        if comp.get("target_range"):
            parts = comp["target_range"].split("-")
            if len(parts) >= 2:
                try:
                    profile_data["salary_max"] = int(parts[1].replace("K", ""))
                except ValueError:
                    profile_data["salary_max"] = 35
            else:
                profile_data["salary_max"] = 35

        target_roles = config.get("target_roles", {})
        primary_roles = target_roles.get("primary", [])
        archetypes = target_roles.get("archetypes", [])

        archetype_names = [a.get("name", "") for a in archetypes]
        role_keywords = []
        for role in primary_roles:
            role_keywords.append(role)
        role_keywords.extend(archetype_names)

        narrative = config.get("narrative", {})
        superpowers = narrative.get("superpowers", [])
        headline = narrative.get("headline", "")

        profile_data["preferences"] = {
            "target_roles": primary_roles,
            "archetypes": archetype_names,
            "headline": headline,
            "superpowers": superpowers,
            "skills_self_assessment": {
                name: {
                    "level": 3,
                    "description": desc,
                    "source": "求职系统config",
                    "selected": True,
                }
                for i, desc in enumerate(superpowers)
                for name in [f"skill_{i}"]
            },
        }

        return {"data": profile_data, "source": "config"}
    except Exception as e:
        print(f"[profile import] Failed to read config: {e}")
        return {"data": profile_data, "source": "default_with_error"}