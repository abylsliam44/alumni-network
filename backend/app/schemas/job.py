from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from app.models.job import JobFormat, JobEmploymentType, JobStatus, ApplicationStatus, JobInterviewStatus


# --- Shared Properties ---
class JobBase(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    format: JobFormat = JobFormat.ONSITE
    employment_type: JobEmploymentType = JobEmploymentType.FULL_TIME
    description: Optional[str] = None
    required_skills: Optional[List[str]] = []
    salary_range: Optional[str] = None


# --- Job CRUD ---
class JobCreate(JobBase):
    pass

class JobUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    format: Optional[JobFormat] = None
    employment_type: Optional[JobEmploymentType] = None
    description: Optional[str] = None
    required_skills: Optional[List[str]] = None
    salary_range: Optional[str] = None

class JobRead(JobBase):
    id: UUID
    company_id: Optional[UUID] = None
    status: JobStatus
    created_by: UUID
    approved_by: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    applications_count: int = 0  # Computed field

    class Config:
        from_attributes = True


class JobList(BaseModel):
    items: List[JobRead]
    total: int
    pages: int
    page: int
    limit: int


# --- Application CRUD ---
class JobApplicationCreate(BaseModel):
    resume_object_name: Optional[str] = None
    resume_url: Optional[str] = None
    cover_letter: Optional[str] = None

class JobApplicationUpdateStatus(BaseModel):
    status: ApplicationStatus


class JobApplicantSummary(BaseModel):
    id: UUID
    name: str
    email: str
    photo_url: Optional[str] = None

    class Config:
        from_attributes = True


class JobSummary(BaseModel):
    id: UUID
    title: str
    company: str
    location: Optional[str] = None
    status: JobStatus

    class Config:
        from_attributes = True


class JobInterviewCreate(BaseModel):
    scheduled_at: datetime


class JobInterviewRead(BaseModel):
    id: UUID
    application_id: UUID
    scheduled_at: datetime
    room_name: str
    status: JobInterviewStatus
    created_by: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class JobApplicationRead(BaseModel):
    id: UUID
    job_id: UUID
    applicant_id: UUID
    cover_letter: Optional[str] = None
    status: ApplicationStatus
    applied_at: datetime

    class Config:
        from_attributes = True


class JobApplicationDetailRead(JobApplicationRead):
    applicant: Optional[JobApplicantSummary] = None
    job: Optional[JobSummary] = None
    latest_interview: Optional[JobInterviewRead] = None
    has_resume: bool = False
    chat_available: bool = True


class JobApplicationList(BaseModel):
    items: List[JobApplicationDetailRead]


class ResumeDownloadResponse(BaseModel):
    download_url: str

# --- Chat Schema ---
class JobChatMessageCreate(BaseModel):
    message: str

class JobChatMessageRead(BaseModel):
    id: UUID
    job_application_id: UUID
    sender_id: UUID
    message: str
    created_at: datetime

    class Config:
        from_attributes = True

class MyApplicationsResponse(BaseModel):
    items: List[JobApplicationRead]
