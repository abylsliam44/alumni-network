import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, DateTime, ForeignKey, Text, Boolean, Enum, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
import enum

class JobFormat(str, enum.Enum):
    ONSITE = "ONSITE"
    REMOTE = "REMOTE"
    HYBRID = "HYBRID"

class JobEmploymentType(str, enum.Enum):
    FULL_TIME = "FULL_TIME"
    PART_TIME = "PART_TIME"
    INTERNSHIP = "INTERNSHIP"
    CONTRACT = "CONTRACT"

class JobStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    CLOSED = "CLOSED"
    REJECTED = "REJECTED"

class ApplicationStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    VIEWED = "VIEWED"
    SHORTLISTED = "SHORTLISTED"
    INTERVIEW = "INTERVIEW"
    REJECTED = "REJECTED"
    HIRED = "HIRED"


class JobInterviewStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=True) # Could link to a Company model if exists, else just ID or string. User requirements says UUID. Assuming free text for legacy or mapped to User/Company entity.
    # Note: User request says "companyId: UUID". But "JobBrowsingFlow" mentions "filter by company".
    # I will allow company_name as well or assume mapped. The previous model had `company: str`.
    # I will keep `company: str` for simplicity as per "simple company name field" in previous context, but user requirement now says "companyId: UUID".
    # I will check if there is a company table. There isn't one visible in file list. I will use `company_name` string and `company_id` as optional UUID if they want to link to something in future.
    # actually, spec says `companyId: UUID`. I will add it. I'll also keep `company_name` for display if needed or assume companyId links to User (Business account)?
    # For now, I'll follow spec strictly on `companyId` but since I don't see a Company model, I won't set a ForeignKey yet.
    # Wait, looking at `JobPosting` it had `company: str`. I will keep `company` (string) for display and add `company_id` (UUID) as nullable.
    company: Mapped[str] = mapped_column(String(200), nullable=False) # Supporting legacy/simple
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    
    location: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    format: Mapped[JobFormat] = mapped_column(Enum(JobFormat), default=JobFormat.ONSITE)
    employment_type: Mapped[JobEmploymentType] = mapped_column(Enum(JobEmploymentType), default=JobEmploymentType.FULL_TIME)
    
    required_skills: Mapped[Optional[list]] = mapped_column(ARRAY(String), nullable=True) # Postgres Array
    salary_range: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.DRAFT)
    
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    # Relationships
    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])
    approver: Mapped["User"] = relationship("User", foreign_keys=[approved_by])
    applications: Mapped[List["JobApplication"]] = relationship("JobApplication", back_populates="job", cascade="all, delete-orphan")


class JobApplication(Base):
    __tablename__ = "job_applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    applicant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    resume_url: Mapped[str] = mapped_column(String(500), nullable=False) # MinIO URL
    cover_letter: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    status: Mapped[ApplicationStatus] = mapped_column(Enum(ApplicationStatus), default=ApplicationStatus.SUBMITTED)
    applied_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    job: Mapped["Job"] = relationship("Job", back_populates="applications")
    applicant: Mapped["User"] = relationship("User", foreign_keys=[applicant_id])
    chat_messages: Mapped[List["JobChatMessage"]] = relationship("JobChatMessage", back_populates="application", cascade="all, delete-orphan")
    interviews: Mapped[List["JobInterview"]] = relationship("JobInterview", back_populates="application", cascade="all, delete-orphan")


class JobInterview(Base):
    __tablename__ = "job_interviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("job_applications.id"), nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    room_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[JobInterviewStatus] = mapped_column(Enum(JobInterviewStatus), default=JobInterviewStatus.SCHEDULED, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    application: Mapped["JobApplication"] = relationship("JobApplication", back_populates="interviews")
    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])


class JobChatMessage(Base):
    __tablename__ = "job_chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("job_applications.id"), nullable=False)
    sender_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    application: Mapped["JobApplication"] = relationship("JobApplication", back_populates="chat_messages")
    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id])
