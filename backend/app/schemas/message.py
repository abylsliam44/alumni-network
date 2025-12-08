from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel


class ConversationRead(BaseModel):
    id: UUID
    participant1_id: UUID
    participant2_id: UUID
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0

    class Config:
        orm_mode = True


class MessageCreate(BaseModel):
    recipient_id: UUID
    content: str
    conversation_id: Optional[UUID] = None


class MessageRead(BaseModel):
    id: UUID
    conversation_id: Optional[UUID]
    sender_id: UUID
    recipient_id: UUID
    content: str
    is_read: bool
    created_at: datetime

    class Config:
        orm_mode = True


class ConversationMessages(BaseModel):
    conversation_id: UUID
    messages: List[MessageRead]


