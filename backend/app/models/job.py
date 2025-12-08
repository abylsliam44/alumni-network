import uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, DateTime, ForeignKey, Text, Boolean, Date, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
import enum

class JobType(str, enum.Enum):
    FULL_TIME = "FULL_TIME"
    PART_TIME = "PART_TIME"
    INTERNSHIP = "INTERNSHIP"
    CONTRACT = "CONTRACT"

class JobPosting(Base):
    __tablename__ = "job_postings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    company: Mapped[str] = mapped_column(String(200), nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    job_type: Mapped[JobType] = mapped_column(Enum(JobType), default=JobType.FULL_TIME)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requirements: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    salary_range: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    deadline: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    posted_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    poster: Mapped["User"] = relationship("User", foreign_keys=[posted_by])
    applications: Mapped[list["JobApplication"]] = relationship("JobApplication", back_populates="job", cascade="all, delete-orphan")

class ApplicationStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    REVIEWED = "REVIEWED"
    REJECTED = "REJECTED"
    ACCEPTED = "ACCEPTED"

class JobApplication(Base):
    __tablename__ = "job_applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("job_postings.id"), nullable=False)
    applicant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    resume_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    cover_letter: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[ApplicationStatus] = mapped_column(Enum(ApplicationStatus), default=ApplicationStatus.SUBMITTED)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    job: Mapped["JobPosting"] = relationship("JobPosting", back_populates="applications")
    applicant: Mapped["User"] = relationship("User", foreign_keys=[applicant_id])
