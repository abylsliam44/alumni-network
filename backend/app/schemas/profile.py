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

class ProfileBase(BaseModel):
    headline: Optional[str] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    website_url: Optional[str] = None
    
    education: List[EducationItem] = []
    experience: List[ExperienceItem] = []
    skills: List[str] = [] # Simplified to list of strings for now as per UserProfile model hint
    
    graduation_year: Optional[int] = None
    availability: Optional[str] = None # "MENTORING", "JOB_SEEKING", "HIRING", "OPEN_TO_CONNECT"

class ProfileUpdate(ProfileBase):
    name: Optional[str] = None
    photo_url: Optional[str] = None

class ProfileRead(ProfileBase):
    id: UUID
    user_id: UUID
    email: str
    name: str
    role: str
    photo_url: Optional[str] = None
    is_verified: bool
    
    class Config:
        from_attributes = True
