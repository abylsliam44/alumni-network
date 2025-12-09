from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel

from app.models.connection import ConnectionStatus
from app.schemas.user import UserRole


class ConnectionUser(BaseModel):
    id: UUID
    name: str
    photo_url: Optional[str] = None
    role: UserRole
    is_mentor: bool = False

    class Config:
        from_attributes = True


class ConnectionCreate(BaseModel):
    recipient_id: UUID


class ConnectionRespond(BaseModel):
    status: ConnectionStatus


class ConnectionRead(BaseModel):
    id: UUID
    requester_id: UUID
    recipient_id: UUID
    status: ConnectionStatus
    created_at: datetime
    updated_at: Optional[datetime] = None
    requester: Optional[ConnectionUser] = None
    recipient: Optional[ConnectionUser] = None

    class Config:
        from_attributes = True


class FriendRead(BaseModel):
    user: ConnectionUser


class FriendsList(BaseModel):
    friends: List[FriendRead]
