from typing import Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel
from app.models.mentorship import MentorshipStatus
from app.schemas.profile import ProfileRead

class MentorshipRequestBase(BaseModel):
    message: Optional[str] = None

class MentorshipRequestCreate(MentorshipRequestBase):
    receiver_id: UUID

class MentorshipRequestUpdate(BaseModel):
    status: MentorshipStatus

class MentorshipRequestRead(MentorshipRequestBase):
    id: UUID
    sender_id: UUID
    receiver_id: UUID
    status: MentorshipStatus
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    sender: Optional[ProfileRead] = None
    receiver: Optional[ProfileRead] = None

    class Config:
        from_attributes = True

class MentorshipRelationshipRead(BaseModel):
    id: UUID
    mentor_id: UUID
    mentee_id: UUID
    goals: Optional[str] = None
    created_at: datetime
    
    mentor: Optional[ProfileRead] = None
    mentee: Optional[ProfileRead] = None

    class Config:
        from_attributes = True
