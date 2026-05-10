from typing import List, Optional, Dict, Any
from pydantic import BaseModel, HttpUrl
from datetime import date
from uuid import UUID
from app.schemas.user import UserRead

class EducationItem(BaseModel):
    school: str
    degree: str
    field_of_study: Optional[str] = None
    start_date: Optional[str] = None # YYYY-MM-DD or just Year
    end_date: Optional[str] = None
    description: Optional[str] = None
    current: bool = False

class ExperienceItem(BaseModel):
    company: str
    position: str
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None
    current: bool = False

class SkillItem(BaseModel):
    name: str
    level: Optional[str] = None # Beginner, Intermediate, Expert


class CareerTrajectoryStep(BaseModel):
    type: str
    label: str
    company: Optional[str] = None
    role: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    current: bool = False


class OpportunityGenerationRead(BaseModel):
    status: str
    requested_interest: Optional[str] = None
    active_interest: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

class ProfileBase(BaseModel):
    headline: Optional[str] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    website_url: Optional[str] = None
    cover_url: Optional[str] = None
    
    education: List[EducationItem] = []
    experience: List[ExperienceItem] = []
    skills: List[str] = [] # Simplified to list of strings for now as per UserProfile model hint
    
    graduation_year: Optional[int] = None
    availability: Optional[str] = None # "MENTORING", "JOB_SEEKING", "HIRING", "OPEN_TO_CONNECT"
    # Mentor capability metadata
    mentor_headline: Optional[str] = None
    mentor_areas_of_help: List[str] = []
    mentor_industries: List[str] = []
    mentor_max_mentees: Optional[int] = None
    mentor_availability_note: Optional[str] = None
    mentor_consent: bool = False

class ProfileUpdate(ProfileBase):
    name: Optional[str] = None
    photo_url: Optional[str] = None

class ProfileRead(ProfileBase):
    id: UUID
    user_id: UUID
    email: str
    name: str
    role: str
    is_mentor: bool = False
    is_admin: bool = False
    photo_url: Optional[str] = None
    is_verified: bool
    career_university: Optional[str] = None
    career_faculty: Optional[str] = None
    career_program: Optional[str] = None
    career_companies: List[str] = []
    career_roles: List[str] = []
    career_projects: List[str] = []
    career_path: List[str] = []
    career_trajectory: List[CareerTrajectoryStep] = []
    mentee_average_rating: Optional[float] = None
    mentee_feedback_count: int = 0
    mentor_active_mentees: int = 0
    mentor_capacity_status: Optional[str] = None
    opportunity_generation: Optional[OpportunityGenerationRead] = None
    
    class Config:
        from_attributes = True
