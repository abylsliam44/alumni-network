from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, field_validator, model_validator
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

    @model_validator(mode='before')
    @classmethod
    def strip_orm_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            'id': data.id,
            'sender_id': data.sender_id,
            'receiver_id': data.receiver_id,
            'status': data.status,
            'created_at': data.created_at,
            'updated_at': getattr(data, 'updated_at', None),
            'message': getattr(data, 'message', None),
        }

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

    @model_validator(mode='before')
    @classmethod
    def strip_orm_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            'id': data.id,
            'mentor_id': data.mentor_id,
            'mentee_id': data.mentee_id,
            'goals': getattr(data, 'goals', None),
            'created_at': data.created_at,
        }

    class Config:
        from_attributes = True


class BecomeMentorRequest(BaseModel):
    headline: Optional[str] = None
    areas_of_help: List[str] = []
    industries: List[str] = []
    max_mentees: Optional[int] = None
    availability_note: Optional[str] = None
    consent_mentor: bool = False


class MentorFeedbackCreate(BaseModel):
    rating: int
    comment: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def rating_range(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("Rating must be between 1 and 5")
        return v


class MentorFeedbackRead(BaseModel):
    id: UUID
    mentor_id: UUID
    mentee_id: UUID
    relationship_id: UUID
    rating: int
    comment: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    mentor: Optional[ProfileRead] = None
    mentee: Optional[ProfileRead] = None

    @model_validator(mode='before')
    @classmethod
    def strip_orm_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            'id': data.id,
            'mentor_id': data.mentor_id,
            'mentee_id': data.mentee_id,
            'relationship_id': data.relationship_id,
            'rating': data.rating,
            'comment': getattr(data, 'comment', None),
            'created_at': data.created_at,
            'updated_at': getattr(data, 'updated_at', None),
        }

    class Config:
        from_attributes = True
