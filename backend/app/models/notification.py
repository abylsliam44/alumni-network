"""
Notification model for MVP v1 - Friend Request Notifications

Supports notifications for:
- Friend/connection requests received
- Friend request accepted
"""

import uuid
from datetime import datetime
from typing import Optional
import enum

from sqlalchemy import String, DateTime, Enum, ForeignKey, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class NotificationType(str, enum.Enum):
    FRIEND_REQUEST = "FRIEND_REQUEST"
    FRIEND_ACCEPTED = "FRIEND_ACCEPTED"
    MENTORSHIP_REQUEST = "MENTORSHIP_REQUEST"
    MENTORSHIP_ACCEPTED = "MENTORSHIP_ACCEPTED"
    NEW_MESSAGE = "NEW_MESSAGE"
    # Event notifications
    EVENT_REGISTRATION = "EVENT_REGISTRATION"
    EVENT_WAITLIST = "EVENT_WAITLIST"
    EVENT_WAITLIST_PROMOTED = "EVENT_WAITLIST_PROMOTED"
    EVENT_REMINDER = "EVENT_REMINDER"
    EVENT_CANCELLED = "EVENT_CANCELLED"
    EVENT_APPROVED = "EVENT_APPROVED"
    MENTOR_FEEDBACK = "MENTOR_FEEDBACK"



class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Reference to the related entity (connection_id, mentorship_id, etc.)
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    
    # Reference to the actor (user who triggered the notification)
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="notifications")
    actor: Mapped[Optional["User"]] = relationship("User", foreign_keys=[actor_id])
