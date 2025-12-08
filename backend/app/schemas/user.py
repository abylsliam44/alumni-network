from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.models.user import UserRole

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.STUDENT
    is_active: bool = True
    is_verified: bool = False

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    password: Optional[str] = None

class UserRead(UserBase):
    id: UUID
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
