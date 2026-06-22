from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import User
from auth import get_current_user
from seed import seed_demo_data

router = APIRouter(prefix="/seed", tags=["seed"])


@router.post("/init")
def init_seed_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    seed_demo_data(current_user.id, db)
    return {"status": "ok", "message": "Demo data seeded"}