from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from app.models.event import RegistrationStatus


class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    date_time: datetime
    location: Optional[str] = None
    max_attendees: Optional[int] = None
    is_public: bool = True


class EventCreate(EventBase):
    pass


class EventRead(EventBase):
    id: UUID
    organizer_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    registrations_count: int = 0

    class Config:
        orm_mode = True


class EventList(BaseModel):
    items: List[EventRead]
    total: int
    pages: int
    page: int
    limit: int


class EventRegistrationCreate(BaseModel):
    pass


class EventRegistrationRead(BaseModel):
    id: UUID
    event_id: UUID
    user_id: UUID
    status: RegistrationStatus
    created_at: datetime

    class Config:
        orm_mode = True


class MyRegistrationsResponse(BaseModel):
    items: List[EventRegistrationRead]


