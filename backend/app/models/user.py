import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Boolean, DateTime, Enum, ForeignKey, Text, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
import enum

class UserRole(str, enum.Enum):
    """
    [MVP v1] Primary identity roles for the platform. Mentor/admin
    capabilities are represented by boolean flags on the user record.
    """
    STUDENT = "STUDENT"
    ALUMNI = "ALUMNI"

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    photo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.STUDENT, nullable=False)
    is_mentor: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    # Relationships
    profile: Mapped["UserProfile"] = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    notifications: Mapped[List["Notification"]] = relationship("Notification", back_populates="user", foreign_keys="[Notification.user_id]", cascade="all, delete-orphan")

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    
    education: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    skills: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    experience: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    career_interests: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    availability: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    graduation_year: Mapped[Optional[int]] = mapped_column(nullable=True)
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    visibility_settings: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    # Mentor capability metadata (only applicable when user.is_mentor is True)
    mentor_headline: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mentor_areas_of_help: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    mentor_industries: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    mentor_max_mentees: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mentor_availability_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mentor_consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cover_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="profile")
