from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel

from app.schemas.user import UserRole


class ConversationUser(BaseModel):
    id: UUID
    name: str
    photo_url: Optional[str] = None
    role: UserRole
    is_mentor: bool

    class Config:
        from_attributes = True


class MessageRead(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    text: str
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_mime_type: Optional[str] = None
    attachment_size: Optional[int] = None
    is_read: bool
    read_at: Optional[datetime] = None
    is_system: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationSummary(BaseModel):
    conversation_id: UUID
    other_user: Optional[ConversationUser] = None
    last_message: Optional[MessageRead] = None
    unread_count: int = 0

    class Config:
        from_attributes = True


class ConversationMessages(BaseModel):
    conversation_id: UUID
    messages: List[MessageRead]
    has_more: bool = False


class StartConversationRequest(BaseModel):
    user_id: UUID


class StartConversationResponse(ConversationSummary):
    pass


class MarkConversationReadRequest(BaseModel):
    last_read_message_id: UUID


class MessageCreate(BaseModel):
    text: str = ""
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_mime_type: Optional[str] = None
    attachment_size: Optional[int] = None


class MessageAttachmentUploadResponse(BaseModel):
    upload_url: str
    file_url: str
    object_name: str
