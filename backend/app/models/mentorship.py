import uuid
import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, ForeignKey, Text, Enum, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base

class MentorshipStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    CANCELLED = "CANCELLED"


class MentorshipRelationshipStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"


class MentorshipSessionStatus(str, enum.Enum):
    PLANNED = "PLANNED"
    DONE = "DONE"
    CANCELLED = "CANCELLED"


class MentorshipRequest(Base):
    __tablename__ = "mentorship_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    receiver_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[MentorshipStatus] = mapped_column(Enum(MentorshipStatus), default=MentorshipStatus.PENDING)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    goals: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    expected_duration: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    preferred_format: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    meeting_frequency: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    decline_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id])
    receiver: Mapped["User"] = relationship("User", foreign_keys=[receiver_id])

class MentorshipRelationship(Base):
    __tablename__ = "mentorship_relationships"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mentor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    mentee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    request_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("mentorship_requests.id"), nullable=True)
    status: Mapped[MentorshipRelationshipStatus] = mapped_column(
        Enum(MentorshipRelationshipStatus),
        default=MentorshipRelationshipStatus.ACTIVE,
        nullable=False,
    )
    goals: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expected_duration: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    preferred_format: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    mentor: Mapped["User"] = relationship("User", foreign_keys=[mentor_id])
    mentee: Mapped["User"] = relationship("User", foreign_keys=[mentee_id])
    request: Mapped[Optional["MentorshipRequest"]] = relationship("MentorshipRequest", foreign_keys=[request_id])
    plan: Mapped[Optional["MentorshipPlan"]] = relationship("MentorshipPlan", back_populates="relationship_obj", uselist=False, cascade="all, delete-orphan")
    sessions: Mapped[list["MentorshipSession"]] = relationship("MentorshipSession", back_populates="relationship_obj", cascade="all, delete-orphan")
    feedbacks: Mapped[list["MentorFeedback"]] = relationship("MentorFeedback", back_populates="relationship_obj", cascade="all, delete-orphan")


class MentorshipPlan(Base):
    __tablename__ = "mentorship_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    relationship_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("mentorship_relationships.id"), nullable=False, unique=True)
    goal: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    milestones: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    meeting_frequency: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    expected_duration: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    next_step: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    relationship_obj: Mapped["MentorshipRelationship"] = relationship("MentorshipRelationship", back_populates="plan", foreign_keys=[relationship_id])


class MentorshipSession(Base):
    __tablename__ = "mentorship_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    relationship_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("mentorship_relationships.id"), nullable=False)
    created_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    topic: Mapped[str] = mapped_column(String(255), nullable=False)
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[MentorshipSessionStatus] = mapped_column(
        Enum(MentorshipSessionStatus),
        default=MentorshipSessionStatus.PLANNED,
        nullable=False,
    )
    room_name: Mapped[Optional[str]] = mapped_column(String(180), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    relationship_obj: Mapped["MentorshipRelationship"] = relationship("MentorshipRelationship", back_populates="sessions", foreign_keys=[relationship_id])
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])


class MentorFeedback(Base):
    __tablename__ = "mentor_feedback"
    __table_args__ = (
        UniqueConstraint("mentor_id", "mentee_id", "relationship_id", name="uq_mentor_feedback_per_relationship"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mentor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    mentee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    relationship_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("mentorship_relationships.id"), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    mentor: Mapped["User"] = relationship("User", foreign_keys=[mentor_id])
    mentee: Mapped["User"] = relationship("User", foreign_keys=[mentee_id])
    relationship_obj: Mapped["MentorshipRelationship"] = relationship("MentorshipRelationship", back_populates="feedbacks", foreign_keys=[relationship_id])
