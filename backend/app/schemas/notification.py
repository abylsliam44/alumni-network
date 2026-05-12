"""
Notification schemas for MVP v1
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel

from app.models.notification import NotificationType


class NotificationActorRead(BaseModel):
    id: UUID
    name: str
    photo_url: Optional[str] = None

    class Config:
        from_attributes = True


class NotificationRead(BaseModel):
    id: UUID
    user_id: UUID
    type: NotificationType
    title: str
    message: str
    is_read: bool
    reference_id: Optional[UUID] = None
    actor_id: Optional[UUID] = None
    actor: Optional[NotificationActorRead] = None
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationList(BaseModel):
    notifications: List[NotificationRead]
    unread_count: int


class NotificationMarkRead(BaseModel):
    notification_ids: List[UUID]
