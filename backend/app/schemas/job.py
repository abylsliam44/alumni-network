from datetime import date, datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from app.models.job import JobType, ApplicationStatus


class JobBase(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    job_type: JobType = JobType.FULL_TIME
    description: Optional[str] = None
    requirements: Optional[dict] = None
    salary_range: Optional[str] = None
    deadline: Optional[date] = None
    is_active: bool = True


class JobCreate(JobBase):
    pass


class JobRead(JobBase):
    id: UUID
    posted_by: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    applications_count: int = 0

    class Config:
        orm_mode = True


class JobList(BaseModel):
    items: List[JobRead]
    total: int
    pages: int
    page: int
    limit: int


class JobApplicationCreate(BaseModel):
    resume_url: Optional[str] = None
    cover_letter: Optional[str] = None


class JobApplicationRead(BaseModel):
    id: UUID
    job_id: UUID
    applicant_id: UUID
    resume_url: Optional[str] = None
    cover_letter: Optional[str] = None
    status: ApplicationStatus
    created_at: datetime

    class Config:
        orm_mode = True


class MyApplicationsResponse(BaseModel):
    items: List[JobApplicationRead]


