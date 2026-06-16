import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import User, Feedback
from auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["feedback"])


class FeedbackCreateRequest(BaseModel):
    type: str = "其他"
    content: str = ""


@router.post("/feedback")
def create_feedback(
    req: FeedbackCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    feedback = Feedback(
        user_id=current_user.id,
        type=req.type,
        content=req.content,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    # Try to write to Feishu table (lark-cli), fallback to log
    try:
        import subprocess
        import json
        payload = json.dumps({
            "user_email": current_user.email,
            "feedback_type": req.type,
            "content": req.content,
        })
        subprocess.run(
            ["lark-cli", "bitable", "record", "create",
             "--table", "feedbacks",
             "--data", payload],
            capture_output=True,
            timeout=5,
        )
    except Exception as e:
        logger.info(f"Feedback #{feedback.id} saved to DB (Feishu sync skipped): {e}")

    return {"success": True, "message": "反馈已提交"}


@router.get("/feedback")
def list_feedback(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    feedbacks = db.query(Feedback).filter(
        Feedback.user_id == current_user.id
    ).all()
    return feedbacks