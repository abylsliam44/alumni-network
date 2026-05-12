import enum
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import ARRAY, Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class ProjectCategory(str, enum.Enum):
    STARTUP = "STARTUP"
    PET_PROJECT = "PET_PROJECT"
    AI_ML = "AI_ML"
    MOBILE_APP = "MOBILE_APP"
    WEB_PLATFORM = "WEB_PLATFORM"
    SAAS = "SAAS"
    UNIVERSITY_PROJECT = "UNIVERSITY_PROJECT"
    HACKATHON = "HACKATHON"
    RESEARCH = "RESEARCH"
    OPEN_SOURCE = "OPEN_SOURCE"


class ProjectRole(str, enum.Enum):
    FRONTEND_DEVELOPER = "FRONTEND_DEVELOPER"
    BACKEND_DEVELOPER = "BACKEND_DEVELOPER"
    FULLSTACK_DEVELOPER = "FULLSTACK_DEVELOPER"
    UI_UX_DESIGNER = "UI_UX_DESIGNER"
    PRODUCT_MANAGER = "PRODUCT_MANAGER"
    ML_ENGINEER = "ML_ENGINEER"
    MOBILE_DEVELOPER = "MOBILE_DEVELOPER"
    DEVOPS_ENGINEER = "DEVOPS_ENGINEER"
    MARKETING = "MARKETING"
    CO_FOUNDER = "CO_FOUNDER"


class ProjectStage(str, enum.Enum):
    IDEA = "IDEA"
    VALIDATION = "VALIDATION"
    MVP = "MVP"
    IN_PROGRESS = "IN_PROGRESS"
    SCALING = "SCALING"


class ProjectApplicationStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    REVIEWED = "REVIEWED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    short_description: Mapped[str] = mapped_column(String(320), nullable=False)
    full_description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[ProjectCategory] = mapped_column(Enum(ProjectCategory), nullable=False)
    required_roles: Mapped[List[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    required_skills: Mapped[List[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    project_stage: Mapped[ProjectStage] = mapped_column(Enum(ProjectStage), nullable=False)
    team_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_remote: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    contact_preference: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    github_link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    demo_link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    tags: Mapped[List[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    university_related: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    startup_idea: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    looking_for_cofounder: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by_user_id])
    applications: Mapped[List["ProjectApplication"]] = relationship(
        "ProjectApplication",
        back_populates="project",
        cascade="all, delete-orphan",
    )


class ProjectApplication(Base):
    __tablename__ = "project_applications"
    __table_args__ = (
        UniqueConstraint("project_id", "applicant_id", name="uq_project_applications_project_applicant"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    applicant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    skills: Mapped[List[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    fit_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[ProjectApplicationStatus] = mapped_column(
        Enum(ProjectApplicationStatus),
        default=ProjectApplicationStatus.SUBMITTED,
        nullable=False,
    )
    applied_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    project: Mapped["Project"] = relationship("Project", back_populates="applications")
    applicant: Mapped["User"] = relationship("User", foreign_keys=[applicant_id])
