from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, validator
from enum import Enum


# Enums for API
class EventTypeEnum(str, Enum):
    CAREER = "career"
    EDUCATIONAL = "educational"
    NETWORKING = "networking"
    RECRUITING = "recruiting"
    INVITE_ONLY = "invite-only"


class EventFormatEnum(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    HYBRID = "hybrid"


class EventStatusEnum(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class RegistrationStatusEnum(str, Enum):
    REGISTERED = "REGISTERED"
    WAITLISTED = "WAITLISTED"
    ATTENDED = "ATTENDED"
    CANCELLED = "CANCELLED"


class MaterialTypeEnum(str, Enum):
    AGENDA = "agenda"
    PRESENTATION = "presentation"
    DOCUMENT = "document"
    OTHER = "other"


# Speaker schemas
class SpeakerBase(BaseModel):
    name: str
    link: Optional[str] = None
    user_id: Optional[UUID] = None


class SpeakerCreate(SpeakerBase):
    pass


class SpeakerRead(SpeakerBase):
    id: UUID
    event_id: UUID
    created_at: datetime
    user_name: Optional[str] = None  # Populated if user_id exists

    class Config:
        from_attributes = True


# Material schemas
class MaterialBase(BaseModel):
    title: str
    url: str
    type: MaterialTypeEnum = MaterialTypeEnum.OTHER


class MaterialCreate(MaterialBase):
    pass


class MaterialRead(MaterialBase):
    id: UUID
    event_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# Review schemas
class ReviewBase(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class ReviewCreate(ReviewBase):
    pass


class ReviewRead(ReviewBase):
    id: UUID
    event_id: UUID
    user_id: UUID
    user_name: str
    user_photo: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewList(BaseModel):
    items: List[ReviewRead]
    total: int
    average_rating: float


# Message schemas (event chat)
class MessageBase(BaseModel):
    content: str


class EventMessageCreate(MessageBase):
    pass


class EventMessageRead(MessageBase):
    id: UUID
    event_id: UUID
    user_id: UUID
    user_name: str
    user_photo: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class EventMessageList(BaseModel):
    items: List[EventMessageRead]
    total: int


# Event schemas
class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    topic: str
    type: EventTypeEnum = EventTypeEnum.NETWORKING
    format: EventFormatEnum = EventFormatEnum.OFFLINE
    start_time: datetime
    end_time: Optional[datetime] = None
    capacity: Optional[int] = None
    location: Optional[str] = None
    online_link: Optional[str] = None
    company_name: Optional[str] = None


class EventCreate(EventBase):
    speakers: Optional[List[SpeakerCreate]] = None
    materials: Optional[List[MaterialCreate]] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    topic: Optional[str] = None
    type: Optional[EventTypeEnum] = None
    format: Optional[EventFormatEnum] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    capacity: Optional[int] = None
    location: Optional[str] = None
    online_link: Optional[str] = None
    company_name: Optional[str] = None


class OrganizerInfo(BaseModel):
    id: UUID
    name: str
    photo_url: Optional[str] = None


class EventRead(EventBase):
    id: UUID
    status: EventStatusEnum
    organizer_id: UUID
    organizer: Optional[OrganizerInfo] = None
    approved_by: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Counts
    registrations_count: int = 0
    waitlist_count: int = 0
    
    # Related data (optional, populated on detail view)
    speakers: Optional[List[SpeakerRead]] = None
    materials: Optional[List[MaterialRead]] = None
    
    # User-specific (set based on current user)
    is_registered: bool = False
    registration_status: Optional[RegistrationStatusEnum] = None

    class Config:
        from_attributes = True


class EventList(BaseModel):
    items: List[EventRead]
    total: int
    pages: int
    page: int
    limit: int


# Registration schemas
class EventRegistrationCreate(BaseModel):
    pass


class EventRegistrationRead(BaseModel):
    id: UUID
    event_id: UUID
    user_id: UUID
    status: RegistrationStatusEnum
    waitlist_position: Optional[int] = None
    user_name: str
    user_photo: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MyRegistrationsResponse(BaseModel):
    items: List[EventRegistrationRead]


class AttendeesList(BaseModel):
    registered: List[EventRegistrationRead]
    waitlisted: List[EventRegistrationRead]
    total_registered: int
    total_waitlisted: int


# Admin schemas
class EventApproval(BaseModel):
    approved: bool
    reason: Optional[str] = None


class EventSubmitForApproval(BaseModel):
    pass
