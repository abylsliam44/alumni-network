from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator
from app.models.user import UserRole

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.STUDENT
    is_active: bool = True
    is_verified: bool = False
    is_mentor: bool = False
    is_admin: bool = False

    class Config:
        from_attributes = True

    @staticmethod
    def _validate_password(v):
        from app.core.security import validate_password_strength
        return validate_password_strength(v)

from pydantic import field_validator

class UserCreate(UserBase):
    password: str

    @field_validator("password")
    def validate_password(cls, v):
        from app.core.security import validate_password_strength
        return validate_password_strength(v)

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    password: Optional[str] = None

    @field_validator("password")
    def validate_password(cls, v):
        if v is None:
            return v
        from app.core.security import validate_password_strength
        return validate_password_strength(v)

class UserRead(UserBase):
    id: UUID
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
