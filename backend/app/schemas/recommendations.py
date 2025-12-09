from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class RecommendationItem(BaseModel):
    target_user_id: str
    name: Optional[str]
    photo_url: Optional[str]
    role: Optional[str]
    available_for_mentorship: bool = False
    match_score: int
    shared_skills: List[str] = []
    shared_interests: List[str] = []
    reason_short: str
    graduation_year: Optional[int] = None
    location: Optional[str] = None
    mentor_headline: Optional[str] = None
    mentor_availability_note: Optional[str] = None


class PeopleRecommendationsResponse(BaseModel):
    user_id: str
    generated_at: datetime
    items: List[RecommendationItem]
