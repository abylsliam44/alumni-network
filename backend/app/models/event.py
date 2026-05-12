import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, DateTime, ForeignKey, Text, Boolean, Integer, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
import enum


class EventType(str, enum.Enum):
    """Type of event."""
    CAREER = "career"
    EDUCATIONAL = "educational"
    NETWORKING = "networking"
    RECRUITING = "recruiting"
    INVITE_ONLY = "invite-only"


class EventFormat(str, enum.Enum):
    """Format of event delivery."""
    ONLINE = "online"
    OFFLINE = "offline"
    HYBRID = "hybrid"


class EventStatus(str, enum.Enum):
    """Event approval status."""
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class RegistrationStatus(str, enum.Enum):
    """Registration status for event participants."""
    REGISTERED = "REGISTERED"
    WAITLISTED = "WAITLISTED"
    ATTENDED = "ATTENDED"
    CANCELLED = "CANCELLED"


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    topic: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    
    # Event type and format - use values_callable to use enum values (lowercase) not names (uppercase)
    type: Mapped[EventType] = mapped_column(Enum(EventType, values_callable=lambda x: [e.value for e in x]), default=EventType.NETWORKING, nullable=False)
    format: Mapped[EventFormat] = mapped_column(Enum(EventFormat, values_callable=lambda x: [e.value for e in x]), default=EventFormat.OFFLINE, nullable=False)
    status: Mapped[EventStatus] = mapped_column(Enum(EventStatus, values_callable=lambda x: [e.value for e in x]), default=EventStatus.DRAFT, nullable=False)
    
    # Time (startTime required, endTime optional)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Location and capacity
    location: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    online_link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    capacity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Company (simplified as string)
    company_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    
    # Organizer and approval
    organizer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Legacy field kept for backward compatibility (maps to is_public for invite-only)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    # Relationships
    organizer: Mapped["User"] = relationship("User", foreign_keys=[organizer_id])
    approver: Mapped[Optional["User"]] = relationship("User", foreign_keys=[approved_by])
    registrations: Mapped[List["EventRegistration"]] = relationship("EventRegistration", back_populates="event", cascade="all, delete-orphan")
    speakers: Mapped[List["EventSpeaker"]] = relationship("EventSpeaker", back_populates="event", cascade="all, delete-orphan")
    materials: Mapped[List["EventMaterial"]] = relationship("EventMaterial", back_populates="event", cascade="all, delete-orphan")
    reviews: Mapped[List["EventReview"]] = relationship("EventReview", back_populates="event", cascade="all, delete-orphan")
    messages: Mapped[List["EventMessage"]] = relationship("EventMessage", back_populates="event", cascade="all, delete-orphan")


class EventRegistration(Base):
    __tablename__ = "event_registrations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[RegistrationStatus] = mapped_column(Enum(RegistrationStatus), default=RegistrationStatus.REGISTERED)
    waitlist_position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    event: Mapped["Event"] = relationship("Event", back_populates="registrations")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class EventSpeaker(Base):
    """Speakers for an event - can be linked to a user or just a name+link."""
    __tablename__ = "event_speakers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    event: Mapped["Event"] = relationship("Event", back_populates="speakers")
    user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[user_id])


class MaterialType(str, enum.Enum):
    """Type of event material."""
    AGENDA = "agenda"
    PRESENTATION = "presentation"
    DOCUMENT = "document"
    OTHER = "other"


class EventMaterial(Base):
    """Materials/resources for an event (stored as MinIO URLs)."""
    __tablename__ = "event_materials"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    type: Mapped[MaterialType] = mapped_column(Enum(MaterialType), default=MaterialType.OTHER)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    event: Mapped["Event"] = relationship("Event", back_populates="materials")


class EventReview(Base):
    """Reviews/feedback for events (available only after event starts)."""
    __tablename__ = "event_reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    event: Mapped["Event"] = relationship("Event", back_populates="reviews")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class EventMessage(Base):
    """Chat messages for events (available only after event starts)."""
    __tablename__ = "event_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    event: Mapped["Event"] = relationship("Event", back_populates="messages")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
