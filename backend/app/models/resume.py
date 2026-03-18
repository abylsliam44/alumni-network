import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class ResumeDocumentStatus(str, enum.Enum):
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    PARSED = "PARSED"
    FAILED = "FAILED"
    DELETED = "DELETED"


class ResumeProcessingStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ResumeConfirmationStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    CONFIRMED = "CONFIRMED"
    ARCHIVED = "ARCHIVED"


class ResumeJobType(str, enum.Enum):
    EXTRACT_TEXT = "EXTRACT_TEXT"
    EXTRACT_STRUCTURED_DATA = "EXTRACT_STRUCTURED_DATA"
    NORMALIZE_DRAFT = "NORMALIZE_DRAFT"
    SYNC_PROFILE = "SYNC_PROFILE"
    BUILD_GRAPH = "BUILD_GRAPH"


class ResumeJobStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class GraphNodeType(str, enum.Enum):
    ALUMNI = "ALUMNI"
    UNIVERSITY = "UNIVERSITY"
    FACULTY = "FACULTY"
    PROGRAM = "PROGRAM"
    GRADUATION_YEAR = "GRADUATION_YEAR"
    COMPANY = "COMPANY"
    ROLE = "ROLE"
    SKILL = "SKILL"
    PROJECT = "PROJECT"
    INTERNSHIP = "INTERNSHIP"
    CERTIFICATE = "CERTIFICATE"


class GraphRelationType(str, enum.Enum):
    STUDIED_AT = "STUDIED_AT"
    BELONGS_TO = "BELONGS_TO"
    GRADUATED_IN = "GRADUATED_IN"
    HAS_SKILL = "HAS_SKILL"
    WORKED_AT = "WORKED_AT"
    HELD_ROLE = "HELD_ROLE"
    PARTICIPATED_IN = "PARTICIPATED_IN"
    COMPLETED_INTERNSHIP = "COMPLETED_INTERNSHIP"
    EARNED_CERTIFICATE = "EARNED_CERTIFICATE"
    TRANSITIONED_TO = "TRANSITIONED_TO"


class CanonicalCompany(Base):
    __tablename__ = "canonical_companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    aliases: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)


class CanonicalRole(Base):
    __tablename__ = "canonical_roles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    aliases: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)


class CanonicalSkill(Base):
    __tablename__ = "canonical_skills"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    aliases: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)


class CanonicalFaculty(Base):
    __tablename__ = "canonical_faculties"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    aliases: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)


class CanonicalProgram(Base):
    __tablename__ = "canonical_programs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    aliases: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)


class ResumeDocument(Base):
    __tablename__ = "resume_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    object_name: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False)
    checksum_sha256: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    status: Mapped[ResumeDocumentStatus] = mapped_column(
        Enum(ResumeDocumentStatus),
        default=ResumeDocumentStatus.UPLOADED,
        nullable=False,
    )
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user = relationship("User")
    import_sessions = relationship("ResumeImportSession", back_populates="document", cascade="all, delete-orphan")


class ResumeImportSession(Base):
    __tablename__ = "resume_import_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    resume_document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resume_documents.id"),
        nullable=False,
        index=True,
    )
    processing_status: Mapped[ResumeProcessingStatus] = mapped_column(
        Enum(ResumeProcessingStatus),
        default=ResumeProcessingStatus.QUEUED,
        nullable=False,
    )
    confirmation_status: Mapped[ResumeConfirmationStatus] = mapped_column(
        Enum(ResumeConfirmationStatus),
        default=ResumeConfirmationStatus.DRAFT,
        nullable=False,
    )
    processing_consent: Mapped[bool] = mapped_column(default=False, nullable=False)
    profile_publish_consent: Mapped[bool] = mapped_column(default=False, nullable=False)
    graph_analytics_consent: Mapped[bool] = mapped_column(default=False, nullable=False)
    last_confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    user = relationship("User")
    document = relationship("ResumeDocument", back_populates="import_sessions")
    jobs = relationship("ResumeProcessingJob", back_populates="import_session", cascade="all, delete-orphan")
    draft = relationship("ResumeExtractionDraft", back_populates="import_session", uselist=False, cascade="all, delete-orphan")


class ResumeProcessingJob(Base):
    __tablename__ = "resume_processing_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    import_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resume_import_sessions.id"),
        nullable=False,
        index=True,
    )
    job_type: Mapped[ResumeJobType] = mapped_column(Enum(ResumeJobType), nullable=False)
    status: Mapped[ResumeJobStatus] = mapped_column(Enum(ResumeJobStatus), default=ResumeJobStatus.QUEUED, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    import_session = relationship("ResumeImportSession", back_populates="jobs")


class ResumeExtractionDraft(Base):
    __tablename__ = "resume_extraction_drafts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    import_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resume_import_sessions.id"),
        nullable=False,
        unique=True,
    )
    raw_extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ocr_metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    draft_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    normalized_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    field_confidences: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    extraction_model: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    extraction_version: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    import_session = relationship("ResumeImportSession", back_populates="draft")


class AlumniCareerProfile(Base):
    __tablename__ = "alumni_career_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    source_import_session_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resume_import_sessions.id"),
        nullable=True,
    )
    source_document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resume_documents.id"),
        nullable=True,
    )
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    faculty_raw: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    faculty_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("canonical_faculties.id"), nullable=True)
    program_raw: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    program_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("canonical_programs.id"), nullable=True)
    graduation_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    current_company_raw: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    current_company_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("canonical_companies.id"), nullable=True)
    current_role_raw: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    current_role_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("canonical_roles.id"), nullable=True)
    profile_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    user = relationship("User")
    education_records = relationship("AlumniEducationRecord", back_populates="career_profile", cascade="all, delete-orphan")
    employment_records = relationship("AlumniEmploymentRecord", back_populates="career_profile", cascade="all, delete-orphan")
    skill_records = relationship("AlumniSkillRecord", back_populates="career_profile", cascade="all, delete-orphan")


class AlumniEducationRecord(Base):
    __tablename__ = "alumni_education_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    career_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("alumni_career_profiles.id"),
        nullable=False,
        index=True,
    )
    school_name: Mapped[str] = mapped_column(String(255), nullable=False)
    degree: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    faculty_raw: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    faculty_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("canonical_faculties.id"), nullable=True)
    program_raw: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    program_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("canonical_programs.id"), nullable=True)
    field_of_study: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    start_date: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    end_date: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    career_profile = relationship("AlumniCareerProfile", back_populates="education_records")


class AlumniEmploymentRecord(Base):
    __tablename__ = "alumni_employment_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    career_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("alumni_career_profiles.id"),
        nullable=False,
        index=True,
    )
    company_raw: Mapped[str] = mapped_column(String(255), nullable=False)
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("canonical_companies.id"), nullable=True)
    role_raw: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("canonical_roles.id"), nullable=True)
    start_date: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    end_date: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_current: Mapped[bool] = mapped_column(default=False, nullable=False)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    career_profile = relationship("AlumniCareerProfile", back_populates="employment_records")


class AlumniSkillRecord(Base):
    __tablename__ = "alumni_skill_records"
    __table_args__ = (
        UniqueConstraint("career_profile_id", "skill_raw", name="uq_alumni_skill_record_profile_skill"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    career_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("alumni_career_profiles.id"),
        nullable=False,
        index=True,
    )
    skill_raw: Mapped[str] = mapped_column(String(255), nullable=False)
    skill_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("canonical_skills.id"), nullable=True)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    career_profile = relationship("AlumniCareerProfile", back_populates="skill_records")


class CareerGraphNode(Base):
    __tablename__ = "career_graph_nodes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[GraphNodeType] = mapped_column(Enum(GraphNodeType), nullable=False)
    entity_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    node_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)


class CareerGraphEdge(Base):
    __tablename__ = "career_graph_edges"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    from_node_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("career_graph_nodes.id"), nullable=False, index=True)
    to_node_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("career_graph_nodes.id"), nullable=False, index=True)
    relation_type: Mapped[GraphRelationType] = mapped_column(Enum(GraphRelationType), nullable=False)
    alumni_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    edge_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    from_node = relationship("CareerGraphNode", foreign_keys=[from_node_id])
    to_node = relationship("CareerGraphNode", foreign_keys=[to_node_id])
    alumni_user = relationship("User")
