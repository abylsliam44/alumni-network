from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class OpportunityFilterRead(BaseModel):
    current_scope: str
    available_scopes: List[str] = []
    selected_graduation_year: Optional[int] = None
    available_graduation_years: List[int] = []


class OpportunityChartItemRead(BaseModel):
    label: str
    count: int


class OpportunityTransitionRead(BaseModel):
    from_step: str
    to_step: str
    count: int


class OpportunityContextRead(BaseModel):
    user_role: str
    faculty: Optional[str] = None
    program: Optional[str] = None
    cohort_label: str
    requested_interest: Optional[str] = None
    using_custom_interest: bool = False
    current_skills: List[str] = []
    strengths: List[str] = []
    gaps: List[str] = []


class OpportunityMarketSnapshotRead(BaseModel):
    alumni_count: int
    direction_count: int
    top_companies: List[str] = []
    top_roles: List[str] = []
    company_chart: List[OpportunityChartItemRead] = []
    role_chart: List[OpportunityChartItemRead] = []
    insights: List[str] = []


class OpportunityDirectionRead(BaseModel):
    key: str
    title: str
    family: str
    alumni_count: int
    top_companies: List[str] = []
    common_skills: List[str] = []
    top_outcomes: List[str] = []
    match_score: int
    representative_path: List[str] = []


class OpportunityRoadmapStageRead(BaseModel):
    key: str
    title: str
    subtitle: Optional[str] = None
    status: str
    items: List[str] = []


class OpportunityPathRead(BaseModel):
    alumni_user_id: Optional[UUID] = None
    alumni_name: str
    headline: Optional[str] = None
    path: List[str] = []


class OpportunityRoadmapRead(BaseModel):
    target_direction_key: str
    target_direction: str
    role_family: str
    match_score: int
    rationale: str
    observed_outcomes: List[str] = []
    top_companies: List[str] = []
    stages: List[OpportunityRoadmapStageRead] = []
    real_paths: List[OpportunityPathRead] = []


class OpportunityPageRead(BaseModel):
    filters: OpportunityFilterRead
    context: OpportunityContextRead
    market_snapshot: OpportunityMarketSnapshotRead
    directions: List[OpportunityDirectionRead] = []
    transitions: List[OpportunityTransitionRead] = []
    roadmap: OpportunityRoadmapRead


class OpportunityInterestGenerateRequest(BaseModel):
    interest: str


class OpportunityInterestGenerationRead(BaseModel):
    status: str
    requested_interest: str
    message: str
