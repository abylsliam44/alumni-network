from typing import Any, Literal
import re
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from app.domain.project_enums import ProjectCategory, ProjectRole, ProjectStage


def clean(items):
    result, seen = [], set()
    for value in items or []:
        value = ' '.join(value.split())
        key = value.casefold()
        if value and key not in seen:
            result.append(value)
            seen.add(key)
    return result

class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid', use_enum_values=True)

class Register(Strict):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    name: str = Field(min_length=1, max_length=100)
    role: Literal['STUDENT', 'ALUMNI'] = 'STUDENT'

    @field_validator('password')
    @classmethod
    def password_strength(cls, value):
        if not all(re.search(pattern, value) for pattern in (r'[A-Z]', r'[a-z]', r'\d', r'[!@#$%^&*(),.?":{}|<>]')):
            raise ValueError('Password must include uppercase, lowercase, digit and special character')
        if len(value.encode('utf-8')) > 72:
            raise ValueError('Password exceeds bcrypt limit')
        return value

    @field_validator('name')
    @classmethod
    def nonempty_name(cls, value):
        value = value.strip()
        if not value:
            raise ValueError('Name cannot be blank')
        return value

class ProfileUpdate(Strict):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    bio: str | None = Field(default=None, max_length=5000)
    photo_url: str | None = Field(default=None, max_length=500)
    headline: str | None = Field(default=None, max_length=255)
    skills: list[str] | None = Field(default=None, max_length=100)
    career_interests: list[str] | None = Field(default=None, max_length=100)
    preferred_project_categories: list[ProjectCategory] | None = None
    education: Any = None
    experience: Any = None
    location: str | None = None
    graduation_year: int | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    website_url: str | None = None

    @field_validator('skills', 'career_interests')
    @classmethod
    def validate_list(cls, value):
        if value is not None and any(len(x.strip()) > 80 for x in value):
            raise ValueError('Elements must not exceed 80 characters')
        return clean(value) if value is not None else None

class Project(Strict):
    title: str = Field(min_length=3, max_length=180)
    short_description: str = Field(min_length=10, max_length=320)
    full_description: str = Field(min_length=20, max_length=20000)
    category: ProjectCategory
    required_roles: list[ProjectRole] = []
    required_skills: list[str] = Field(default_factory=list, max_length=100)
    project_stage: ProjectStage
    team_size: int | None = Field(default=None, ge=1, le=100)
    is_remote: bool = True
    contact_preference: str | None = Field(default=None, max_length=120)
    github_link: str | None = Field(default=None, max_length=500)
    demo_link: str | None = Field(default=None, max_length=500)
    tags: list[str] = Field(default_factory=list, max_length=100)
    university_related: bool = False
    startup_idea: bool = False
    looking_for_cofounder: bool = False

    @field_validator('required_skills', 'tags')
    @classmethod
    def normalize(cls, value):
        if any(len(x.strip()) > 80 for x in value):
            raise ValueError('Elements must not exceed 80 characters')
        return clean(value)

class Application(Strict):
    message: str = Field(min_length=10, max_length=2000)
    skills: list[str] = Field(default_factory=list, max_length=100)
    fit_reason: str | None = Field(default=None, max_length=2000)

class Interaction(Strict):
    event_id: UUID
    item_id: UUID
    event_type: Literal['VIEW', 'SAVE', 'UNSAVE', 'RATE']
    rating: int | None = Field(default=None, ge=1, le=5, strict=True)

    @model_validator(mode='after')
    def rating_required(self):
        if (self.event_type == 'RATE') != (self.rating is not None):
            raise ValueError('rating is required only for RATE')
        return self
