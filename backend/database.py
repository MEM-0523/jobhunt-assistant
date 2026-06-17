import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# Support both SQLite (local dev) and PostgreSQL (Supabase/Render)
# Local dev:  DATABASE_URL not set → defaults to SQLite
# Production: DATABASE_URL=postgresql://... (Supabase connection string)
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./job_assistant.db")
# Strip quotes that may be added by Railway raw editor
SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.strip('"').strip("'")

if "sqlite" in SQLALCHEMY_DATABASE_URL:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
elif "postgresql" in SQLALCHEMY_DATABASE_URL:
    # Supabase/Render PostgreSQL — use connection pooling args for stability
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
    )
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()