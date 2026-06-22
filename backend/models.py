from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, JSON, DateTime, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    profile = relationship("Profile", back_populates="user", uselist=False)
    jobs = relationship("Job", back_populates="user")
    applications = relationship("Application", back_populates="user")
    resumes = relationship("Resume", back_populates="user")
    interview_preps = relationship("InterviewPrep", back_populates="user")
    interview_reviews = relationship("InterviewReview", back_populates="user")
    feedbacks = relationship("Feedback", back_populates="user")
    favorites = relationship("JobFavorite", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    experiences = relationship("Experience", back_populates="user")
    strengths = relationship("Strength", back_populates="user")


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    name = Column(String, default="")
    phone = Column(String, default="")
    city = Column(String, default="")
    salary_min = Column(Integer, default=0)
    salary_max = Column(Integer, default=0)
    deal_breakers = Column(JSON, default=[])
    preferences = Column(JSON, default={})
    # Career transition personalization fields
    risk_tolerance = Column(String, default="medium")  # low/medium/high
    learning_pace = Column(String, default="part-time")  # full-time/part-time/intensive
    target_timeline = Column(String, default="6months")  # 3months/6months/12months
    target_industries = Column(JSON, default=[])  # e.g. ["AI/互联网", "智慧城市"]
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="profile")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, default="")
    company = Column(String, default="")
    salary = Column(String, default="")
    city = Column(String, default="")
    platform = Column(String, default="")
    jd_text = Column(Text, default="")
    match_score = Column(Float, default=0.0)
    rating = Column(Integer, default=0)
    status = Column(String, default="new")
    jd_url = Column(String, default="")
    data_source = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="jobs")
    applications = relationship("Application", back_populates="job")


class JobFavorite(Base):
    __tablename__ = "job_favorites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"))
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="favorites")
    job = relationship("Job")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    status = Column(String, default="applied")
    applied_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, default="")
    is_demo = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="applications")
    job = relationship("Job", back_populates="applications")


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, default="")
    version = Column(Integer, default=1)
    file_type = Column(String(10), default="md")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="resumes")


class InterviewPrep(Base):
    __tablename__ = "interview_preps"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    content = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="interview_preps")


class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String, default="")
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="feedbacks")


class InterviewReview(Base):
    __tablename__ = "interview_reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    interview_date = Column(DateTime, nullable=False)
    questions_review = Column(Text, default="")
    self_rating = Column(Integer, default=3)
    interviewer_feedback = Column(Text, default="")
    improvements = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="interview_reviews")


class JobCache(Base):
    """Cache table for jobs fetched from external APIs (Himalayas, Remotive, etc.)
    Enables deduplication and reduces API calls."""
    __tablename__ = "job_cache"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(50), nullable=False)  # 'himalayas'/'remotive'/'greenhouse'/'lever'
    source_id = Column(String(255), nullable=False)  # unique ID from source platform
    title = Column(String(500), default="")
    company = Column(String(255), default="")
    salary = Column(String(100), default="")
    city = Column(String(100), default="")
    country = Column(String(50), default="")
    platform = Column(String(50), default="")
    jd_text = Column(Text, default="")
    jd_url = Column(String(1000), default="")
    remote = Column(Boolean, default=False)
    employment_type = Column(String(50), default="")
    categories = Column(JSON, default=[])
    raw_data = Column(JSON, default={})
    fetched_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String(50), default="info")  # info/success/warning/reminder
    title = Column(String(255), default="")
    message = Column(Text, default="")
    is_read = Column(Boolean, default=False)
    link = Column(String(500), default="")  # 点击跳转链接
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")


class Experience(Base):
    __tablename__ = "experiences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String(50), default="project")  # project/internship/course/club/self_study/part_time
    title = Column(String(255), default="")
    background = Column(Text, default="")
    task = Column(Text, default="")
    action = Column(Text, default="")
    method_tool = Column(Text, default="")
    result = Column(Text, default="")
    evidence = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user = relationship("User", back_populates="experiences")


class Strength(Base):
    __tablename__ = "strengths"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), default="")
    classification = Column(String(50), default="fact")  # fact/assumption/inference
    evidence = Column(Text, default="")
    behavior = Column(Text, default="")
    ability = Column(Text, default="")
    job_signal = Column(Text, default="")
    confidence = Column(String(20), default="medium")  # high/medium/low
    missing_proof = Column(Text, default="")
    next_action = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="strengths")


class InterviewPracticeSession(Base):
    """Stores interactive interview practice sessions."""
    __tablename__ = "interview_practice_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_role = Column(String(255), default="")
    job_description = Column(Text, default="")
    status = Column(String(20), default="active")  # active/ended
    current_question = Column(Text, default="")
    question_type = Column(String(50), default="general")
    follow_up_count = Column(Integer, default=0)
    transcript = Column(JSON, default=[])  # list of {role, content, ...}
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class PlatformAuth(Base):
    """招聘平台登录凭证"""
    __tablename__ = "platform_auths"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # 平台标识：boss / liepin / 51job
    platform = Column(String(20), nullable=False, index=True)
    # Cookie JSON 字符串（BOSS直聘、前程无忧用）
    cookies = Column(Text, nullable=True)
    # 猎聘 MCP Token（猎聘用）
    token = Column(Text, nullable=True)
    # 状态：active / expired / disconnected
    status = Column(String(20), default="disconnected", nullable=False)
    # 过期时间
    expires_at = Column(DateTime, nullable=True)
    # Playwright 用户数据目录路径（每个用户每个平台独立）
    user_data_dir = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关联用户
    user = relationship("User")

    # 唯一约束：一个用户一个平台只能有一条记录
    __table_args__ = (UniqueConstraint('user_id', 'platform', name='_user_platform_uc'),)