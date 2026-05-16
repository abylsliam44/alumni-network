from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, field_validator

from app.models.project import ProjectApplicationStatus, ProjectCategory, ProjectRole, ProjectStage


def _clean_list(values: Optional[List[str]]) -> List[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for value in values or []:
        item = " ".join(str(value).split()).strip()
        key = item.lower()
        if item and key not in seen:
            seen.add(key)
            cleaned.append(item)
    return cleaned


class ProjectCreatorRead(BaseModel):
    id: UUID
    name: str
    email: Optional[str] = None
    photo_url: Optional[str] = None
    bio: Optional[str] = None

    class Config:
        from_attributes = True


class ProjectBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=180)
    short_description: str = Field(..., min_length=10, max_length=320)
    full_description: str = Field(..., min_length=20)
    category: ProjectCategory
    required_roles: List[ProjectRole] = []
    required_skills: List[str] = []
    project_stage: ProjectStage
    team_size: Optional[int] = Field(default=None, ge=1, le=100)
    is_remote: bool = True
    contact_preference: Optional[str] = Field(default=None, max_length=120)
    github_link: Optional[HttpUrl] = None
    demo_link: Optional[HttpUrl] = None
    tags: List[str] = []
    university_related: bool = False
    startup_idea: bool = False
    looking_for_cofounder: bool = False

    @field_validator("title", "short_description", "full_description", "contact_preference", mode="before")
    @classmethod
    def normalize_text(cls, value):
        if value is None:
            return value
        return " ".join(str(value).split()).strip()

    @field_validator("required_skills", "tags", mode="before")
    @classmethod
    def normalize_lists(cls, value):
        return _clean_list(value)


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=3, max_length=180)
    short_description: Optional[str] = Field(default=None, min_length=10, max_length=320)
    full_description: Optional[str] = Field(default=None, min_length=20)
    category: Optional[ProjectCategory] = None
    required_roles: Optional[List[ProjectRole]] = None
    required_skills: Optional[List[str]] = None
    project_stage: Optional[ProjectStage] = None
    team_size: Optional[int] = Field(default=None, ge=1, le=100)
    is_remote: Optional[bool] = None
    contact_preference: Optional[str] = Field(default=None, max_length=120)
    github_link: Optional[HttpUrl] = None
    demo_link: Optional[HttpUrl] = None
    tags: Optional[List[str]] = None
    university_related: Optional[bool] = None
    startup_idea: Optional[bool] = None
    looking_for_cofounder: Optional[bool] = None

    @field_validator("title", "short_description", "full_description", "contact_preference", mode="before")
    @classmethod
    def normalize_text(cls, value):
        if value is None:
            return value
        return " ".join(str(value).split()).strip()

    @field_validator("required_skills", "tags", mode="before")
    @classmethod
    def normalize_lists(cls, value):
        return _clean_list(value)


class ProjectRead(ProjectBase):
    id: UUID
    created_by_user_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    applications_count: int = 0
    match_score: int = 0
    matched_skills: List[str] = []
    has_applied: bool = False
    creator: Optional[ProjectCreatorRead] = None

    class Config:
        from_attributes = True


class ProjectList(BaseModel):
    items: List[ProjectRead]
    total: int
    pages: int
    page: int
    limit: int


class ProjectApplicationCreate(BaseModel):
    message: str = Field(..., min_length=10, max_length=2000)
    skills: List[str] = []
    fit_reason: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("message", "fit_reason", mode="before")
    @classmethod
    def normalize_text(cls, value):
        if value is None:
            return value
        return " ".join(str(value).split()).strip()

    @field_validator("skills", mode="before")
    @classmethod
    def normalize_skills(cls, value):
        return _clean_list(value)


class ProjectApplicationRead(BaseModel):
    id: UUID
    project_id: UUID
    applicant_id: UUID
    message: str
    skills: List[str] = []
    fit_reason: Optional[str] = None
    status: ProjectApplicationStatus
    applied_at: datetime
    match_score: int = 0
    applicant: Optional[ProjectCreatorRead] = None
    project: Optional[ProjectRead] = None

    class Config:
        from_attributes = True


class SuggestedCandidateRead(BaseModel):
    user: ProjectCreatorRead
    skills: List[str] = []
    match_score: int
    matched_skills: List[str] = []


class UserProjectsRead(BaseModel):
    created_projects: List[ProjectRead] = []
    joined_projects: List[ProjectRead] = []
