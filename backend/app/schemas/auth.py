from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator, ConfigDict
from app.models.user import UserRole
from app.schemas.user import UserRead

class Token(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    refresh_token: Optional[str] = None

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    type: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Optional[UserRole] = UserRole.STUDENT
    model_config = ConfigDict(extra="forbid")

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, value):
        if value is None:
            return UserRole.STUDENT
        try:
            return UserRole(value)
        except ValueError:
            raise ValueError("Role must be one of STUDENT or ALUMNI")

    @field_validator("password")
    def validate_password(cls, v):
        from app.core.security import validate_password_strength
        return validate_password_strength(v)


class AuthResponse(BaseModel):
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user: UserRead
