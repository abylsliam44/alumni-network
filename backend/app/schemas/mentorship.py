from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, model_validator
from app.models.mentorship import MentorshipRelationshipStatus, MentorshipSessionStatus, MentorshipStatus
from app.schemas.profile import ProfileRead

class MentorshipRequestBase(BaseModel):
    message: Optional[str] = None
    goals: List[str] = Field(default_factory=list)
    expected_duration: Optional[str] = None
    preferred_format: Optional[str] = None

class MentorshipRequestCreate(MentorshipRequestBase):
    receiver_id: UUID

class MentorshipRequestUpdate(BaseModel):
    status: MentorshipStatus


class MentorshipRequestDecline(BaseModel):
    reason: Optional[str] = None


class MentorshipRequestRead(MentorshipRequestBase):
    id: UUID
    sender_id: UUID
    receiver_id: UUID
    status: MentorshipStatus
    decline_reason: Optional[str] = None
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
            'goals': getattr(data, 'goals', None) or [],
            'expected_duration': getattr(data, 'expected_duration', None),
            'preferred_format': getattr(data, 'preferred_format', None),
            'decline_reason': getattr(data, 'decline_reason', None),
        }

    class Config:
        from_attributes = True


class MentorshipPlanBase(BaseModel):
    goal: Optional[str] = None
    milestones: List[str] = Field(default_factory=list)
    meeting_frequency: Optional[str] = None
    expected_duration: Optional[str] = None
    notes: Optional[str] = None
    next_step: Optional[str] = None


class MentorshipPlanUpsert(MentorshipPlanBase):
    pass


class MentorshipPlanRead(MentorshipPlanBase):
    id: UUID
    relationship_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    @model_validator(mode='before')
    @classmethod
    def strip_orm_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            'id': data.id,
            'relationship_id': data.relationship_id,
            'goal': getattr(data, 'goal', None),
            'milestones': getattr(data, 'milestones', None) or [],
            'meeting_frequency': getattr(data, 'meeting_frequency', None),
            'expected_duration': getattr(data, 'expected_duration', None),
            'notes': getattr(data, 'notes', None),
            'next_step': getattr(data, 'next_step', None),
            'created_at': data.created_at,
            'updated_at': getattr(data, 'updated_at', None),
        }

    class Config:
        from_attributes = True


class MentorshipSessionCreate(BaseModel):
    topic: str
    scheduled_at: Optional[datetime] = None
    notes: Optional[str] = None


class MentorshipSessionUpdate(BaseModel):
    topic: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    status: Optional[MentorshipSessionStatus] = None
    notes: Optional[str] = None


class MentorshipSessionRead(BaseModel):
    id: UUID
    relationship_id: UUID
    created_by_id: UUID
    topic: str
    scheduled_at: Optional[datetime] = None
    status: MentorshipSessionStatus
    room_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MentorshipRelationshipRead(BaseModel):
    id: UUID
    mentor_id: UUID
    mentee_id: UUID
    request_id: Optional[UUID] = None
    status: MentorshipRelationshipStatus = MentorshipRelationshipStatus.ACTIVE
    goals: Optional[str] = None
    expected_duration: Optional[str] = None
    preferred_format: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    mentor: Optional[ProfileRead] = None
    mentee: Optional[ProfileRead] = None
    plan: Optional[MentorshipPlanRead] = None
    sessions: List[MentorshipSessionRead] = Field(default_factory=list)

    @model_validator(mode='before')
    @classmethod
    def strip_orm_relations(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            'id': data.id,
            'mentor_id': data.mentor_id,
            'mentee_id': data.mentee_id,
            'request_id': getattr(data, 'request_id', None),
            'status': getattr(data, 'status', MentorshipRelationshipStatus.ACTIVE),
            'goals': getattr(data, 'goals', None),
            'expected_duration': getattr(data, 'expected_duration', None),
            'preferred_format': getattr(data, 'preferred_format', None),
            'created_at': data.created_at,
            'updated_at': getattr(data, 'updated_at', None),
            'plan': MentorshipPlanRead.model_validate(data.plan) if getattr(data, 'plan', None) else None,
            'sessions': [MentorshipSessionRead.model_validate(item) for item in (getattr(data, 'sessions', None) or [])],
        }

    class Config:
        from_attributes = True


class MentorshipRelationshipStatusUpdate(BaseModel):
    status: MentorshipRelationshipStatus


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
