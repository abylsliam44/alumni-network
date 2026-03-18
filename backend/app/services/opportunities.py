from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.resume import AlumniCareerProfile, ResumeImportSession
from app.models.user import User, UserProfile
from app.schemas.opportunities import (
    OpportunityChartItemRead,
    OpportunityContextRead,
    OpportunityDirectionRead,
    OpportunityFilterRead,
    OpportunityMarketSnapshotRead,
    OpportunityPageRead,
    OpportunityPathRead,
    OpportunityRoadmapRead,
    OpportunityRoadmapStageRead,
    OpportunityTransitionRead,
)

OPPORTUNITY_GENERATION_KEY = "opportunity_generation"


class OpportunityGenerationPendingError(Exception):
    def __init__(self, requested_interest: str | None = None):
        self.requested_interest = requested_interest
        super().__init__("Your roadmap is still being generated")


@dataclass
class _DirectionAggregate:
    title: str
    family: str
    profiles: list[AlumniCareerProfile]
    public_profiles: list[AlumniCareerProfile]
    companies: Counter[str]
    skills: Counter[str]
    entry_roles: Counter[str]
    outcome_roles: Counter[str]
    transitions: Counter[tuple[str, str]]
    representative_paths: list[list[str]]


ROLE_FAMILY_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("machine-learning", ("ml", "machine learning", "ai", "data scientist", "llm", "nlp", "computer vision")),
    ("backend", ("backend", "api", "server", "platform", "python", "java", "golang", "software engineer")),
    ("data", ("data analyst", "analytics", "bi", "data engineer", "sql analyst", "business intelligence")),
    ("product", ("product", "pm", "product manager", "growth", "strategy")),
    ("frontend", ("frontend", "front-end", "react", "web engineer", "ui engineer")),
    ("devops", ("devops", "site reliability", "sre", "cloud", "infrastructure", "platform engineer")),
    ("mobile", ("ios", "android", "mobile", "flutter", "react native")),
]


ROLE_FAMILY_BLUEPRINTS: dict[str, dict[str, object]] = {
    "backend": {
        "foundation_title": "Engineering Core",
        "foundation_subtitle": "Core backend concepts alumni from this track most often share",
        "portfolio_title": "Proof of Work",
        "portfolio_items": ["Build 2 production-like APIs", "Ship auth, caching, and database flows", "Document one system design case"],
        "entry_title": "Typical Entry Roles",
        "next_title": "Next Career Leap",
        "next_items": ["Junior Backend Engineer", "Backend Engineer", "Platform or Senior Backend track"],
    },
    "machine-learning": {
        "foundation_title": "Math + ML Foundation",
        "foundation_subtitle": "The technical base most common among alumni who reached ML roles",
        "portfolio_title": "Model + Product Portfolio",
        "portfolio_items": ["Train and evaluate 2 ML projects", "Deploy one inference API", "Show experimentation and metrics"],
        "entry_title": "Typical Entry Roles",
        "next_title": "Next Career Leap",
        "next_items": ["ML Intern", "Data Analyst / DS Intern", "ML Engineer or Applied AI role"],
    },
    "data": {
        "foundation_title": "Analytics Core",
        "foundation_subtitle": "The analytical toolkit that appears most often in this route",
        "portfolio_title": "Analysis Portfolio",
        "portfolio_items": ["Build one dashboard case", "Solve one KPI / funnel case", "Ship one SQL + Python analysis"],
        "entry_title": "Typical Entry Roles",
        "next_title": "Next Career Leap",
        "next_items": ["Data Analyst Intern", "Junior Analyst", "Analytics / Data Engineering track"],
    },
    "product": {
        "foundation_title": "Product Thinking",
        "foundation_subtitle": "Signals that often show up before alumni move into product roles",
        "portfolio_title": "Product Proof",
        "portfolio_items": ["Write one product case", "Run one user/problem discovery project", "Show metrics and prioritization thinking"],
        "entry_title": "Typical Entry Roles",
        "next_title": "Next Career Leap",
        "next_items": ["Product Intern", "Business Analyst", "Associate Product Manager"],
    },
    "frontend": {
        "foundation_title": "Frontend Core",
        "foundation_subtitle": "Common foundations behind successful frontend outcomes",
        "portfolio_title": "Ship UI Work",
        "portfolio_items": ["Build 2 polished frontend apps", "Show state, API, and responsive UI work", "Document component decisions"],
        "entry_title": "Typical Entry Roles",
        "next_title": "Next Career Leap",
        "next_items": ["Frontend Intern", "Junior Frontend Engineer", "Product UI / Web Engineer"],
    },
    "devops": {
        "foundation_title": "Infra Fundamentals",
        "foundation_subtitle": "Most common infra and reliability signals in this path",
        "portfolio_title": "Operational Proof",
        "portfolio_items": ["Deploy one cloud service", "Show CI/CD automation", "Document monitoring and incident thinking"],
        "entry_title": "Typical Entry Roles",
        "next_title": "Next Career Leap",
        "next_items": ["DevOps Intern", "Cloud Engineer", "SRE / Platform Engineer"],
    },
    "mobile": {
        "foundation_title": "Mobile Core",
        "foundation_subtitle": "Mobile patterns and product signals common in alumni trajectories",
        "portfolio_title": "App Portfolio",
        "portfolio_items": ["Ship one real mobile app", "Integrate auth, API, and local state", "Show store-ready UX polish"],
        "entry_title": "Typical Entry Roles",
        "next_title": "Next Career Leap",
        "next_items": ["Mobile Intern", "Junior Mobile Engineer", "Platform mobile track"],
    },
    "general": {
        "foundation_title": "Career Core",
        "foundation_subtitle": "Most common signals that appear in this direction",
        "portfolio_title": "Proof of Capability",
        "portfolio_items": ["Create 2 role-relevant projects", "Document outcomes and technical decisions", "Show repeatable execution"],
        "entry_title": "Typical Entry Roles",
        "next_title": "Next Career Leap",
        "next_items": ["Internship", "Junior role", "First full-time transition"],
    },
}


def _clean(value: object | None) -> str | None:
    if value is None:
        return None
    text = str(value)
    compact = " ".join(text.split()).strip()
    return compact or None


def _normalize_key(value: str | None) -> str | None:
    cleaned = _clean(value)
    return cleaned.lower() if cleaned else None


def _tokenize(value: str | None) -> set[str]:
    normalized = _normalize_key(value)
    if not normalized:
        return set()
    return {token for token in re.split(r"[^a-z0-9+#]+", normalized) if len(token) > 1}


def _profile_settings(profile: UserProfile | None) -> dict:
    if not profile or not isinstance(profile.visibility_settings, dict):
        return {}
    return dict(profile.visibility_settings)


def get_opportunity_generation_state(profile: UserProfile | None) -> dict | None:
    settings = _profile_settings(profile)
    state = settings.get(OPPORTUNITY_GENERATION_KEY)
    return dict(state) if isinstance(state, dict) else None


def is_opportunity_generation_pending(profile: UserProfile | None) -> bool:
    state = get_opportunity_generation_state(profile)
    return bool(state and state.get("status") == "PENDING")


def get_active_custom_interest(profile: UserProfile | None) -> str | None:
    state = get_opportunity_generation_state(profile)
    if not state or state.get("status") != "COMPLETED":
        return None
    return _clean(state.get("active_interest") or state.get("requested_interest"))


def set_opportunity_generation_state(
    profile: UserProfile,
    *,
    status: str,
    requested_interest: str | None,
    active_interest: str | None = None,
    started_at: str | None = None,
    completed_at: str | None = None,
) -> None:
    settings = _profile_settings(profile)
    settings[OPPORTUNITY_GENERATION_KEY] = {
        "status": status,
        "requested_interest": _clean(requested_interest),
        "active_interest": _clean(active_interest),
        "started_at": started_at,
        "completed_at": completed_at,
    }
    profile.visibility_settings = settings


def clear_opportunity_generation_state(profile: UserProfile) -> None:
    settings = _profile_settings(profile)
    settings.pop(OPPORTUNITY_GENERATION_KEY, None)
    profile.visibility_settings = settings or None


def _dedupe(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    items: list[str] = []
    for value in values:
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        items.append(value)
    return items


def _employment_sort_key(item) -> tuple[str, str, str]:
    return (
        item.start_date or "",
        item.end_date or "",
        item.created_at.isoformat(),
    )


def _sorted_employment(profile: AlumniCareerProfile):
    return sorted(profile.employment_records or [], key=_employment_sort_key)


def _extract_path(profile: AlumniCareerProfile) -> list[str]:
    path: list[str] = ["Astana IT University"]
    for item in _sorted_employment(profile):
        company = _clean(item.company_raw)
        role = _clean(item.role_raw)
        if role and company:
            path.append(f"{role} at {company}")
        elif role or company:
            path.append(role or company)
    return _dedupe(path)


def _extract_entry_role(profile: AlumniCareerProfile) -> str | None:
    employment = _sorted_employment(profile)
    if not employment:
        return _clean(profile.current_role_raw)
    return _clean(employment[0].role_raw) or _clean(employment[0].company_raw)


def _extract_current_role(profile: AlumniCareerProfile) -> str | None:
    current_role = _clean(profile.current_role_raw)
    if current_role:
        return current_role
    employment = _sorted_employment(profile)
    if not employment:
        return None
    latest = employment[-1]
    return _clean(latest.role_raw) or _clean(latest.company_raw)


def _extract_current_company(profile: AlumniCareerProfile) -> str | None:
    current_company = _clean(profile.current_company_raw)
    if current_company:
        return current_company
    employment = _sorted_employment(profile)
    if not employment:
        return None
    return _clean(employment[-1].company_raw)


def _infer_academic_scope(user: User, profile: UserProfile | None, career_profile: AlumniCareerProfile | None) -> tuple[str | None, str | None]:
    faculty = _clean(career_profile.faculty_raw) if career_profile else None
    program = _clean(career_profile.program_raw) if career_profile else None
    if faculty or program:
        return faculty, program

    for item in profile.education or [] if profile else []:
        if not isinstance(item, dict):
            continue
        inferred_program = _clean(item.get("field_of_study")) or _clean(item.get("program"))
        inferred_faculty = _clean(item.get("degree"))
        if inferred_faculty or inferred_program:
            return inferred_faculty, inferred_program

    return None, None


def _match_scope(profile: AlumniCareerProfile, faculty: str | None, program: str | None) -> bool:
    if program and _normalize_key(profile.program_raw) == _normalize_key(program):
        return True
    if faculty and _normalize_key(profile.faculty_raw) == _normalize_key(faculty):
        return True
    return False


def _top_values(counter: Counter[str], limit: int) -> list[str]:
    return [value for value, _ in counter.most_common(limit)]


def _counter_to_chart(counter: Counter[str], limit: int) -> list[OpportunityChartItemRead]:
    return [OpportunityChartItemRead(label=label, count=count) for label, count in counter.most_common(limit)]


def _infer_role_family(title: str | None) -> str:
    normalized = (_normalize_key(title) or "")
    for family, rules in ROLE_FAMILY_RULES:
        if any(rule in normalized for rule in rules):
            return family
    return "general"


def _blueprint_for_family(family: str) -> dict[str, object]:
    return ROLE_FAMILY_BLUEPRINTS.get(family, ROLE_FAMILY_BLUEPRINTS["general"])


def _score_direction_for_interest(direction: OpportunityDirectionRead, interest: str) -> int:
    interest_tokens = _tokenize(interest)
    if not interest_tokens:
        return 0

    direction_tokens: set[str] = set()
    for value in [
        direction.title,
        direction.family,
        *direction.top_outcomes,
        *direction.common_skills,
        *direction.top_companies,
    ]:
        direction_tokens.update(_tokenize(value))

    score = len(interest_tokens & direction_tokens) * 3
    title_key = _normalize_key(direction.title) or ""
    family_key = _normalize_key(direction.family) or ""
    interest_key = _normalize_key(interest) or ""

    if interest_key and interest_key in title_key:
        score += 4
    if interest_key and interest_key in family_key:
        score += 3
    return score


def _pick_direction_for_interest(
    directions: list[OpportunityDirectionRead],
    interest: str | None,
) -> OpportunityDirectionRead | None:
    cleaned_interest = _clean(interest)
    if not cleaned_interest or not directions:
        return None

    inferred_family = _infer_role_family(cleaned_interest)
    if inferred_family != "general":
        exact_family = next((item for item in directions if item.key == inferred_family), None)
        if exact_family:
            return exact_family

    ranked = sorted(
        directions,
        key=lambda item: (
            -_score_direction_for_interest(item, cleaned_interest),
            -item.alumni_count,
            item.title,
        ),
    )
    best = ranked[0]
    return best if _score_direction_for_interest(best, cleaned_interest) > 0 else None


def _extract_transitions(profile: AlumniCareerProfile) -> list[tuple[str, str]]:
    steps = _extract_path(profile)
    return [(steps[idx], steps[idx + 1]) for idx in range(len(steps) - 1)]


def _has_internship_signal(profile: AlumniCareerProfile) -> bool:
    for item in profile.employment_records or []:
        role = (_normalize_key(item.role_raw) or "")
        company = (_normalize_key(item.company_raw) or "")
        if "intern" in role or "intern" in company:
            return True
    return False


def _format_family_label(family: str) -> str:
    return family.replace("-", " ").title()


def _track_title_for_family(family: str) -> str:
    titles = {
        "backend": "Backend Engineering Track",
        "machine-learning": "Machine Learning Track",
        "data": "Data & Analytics Track",
        "product": "Product Track",
        "frontend": "Frontend Engineering Track",
        "devops": "DevOps & Platform Track",
        "mobile": "Mobile Engineering Track",
        "general": "General Career Growth Track",
    }
    return titles.get(family, titles["general"])


def _build_market_insights(
    active_profiles: list[AlumniCareerProfile],
    transition_counter: Counter[tuple[str, str]],
    family_counter: Counter[str],
) -> list[str]:
    insights: list[str] = []
    if not active_profiles:
        return insights

    avg_steps = sum(len(profile.employment_records or []) for profile in active_profiles) / max(len(active_profiles), 1)
    insights.append(f"Average observed career path length: {avg_steps:.1f} role steps.")

    internship_count = sum(1 for profile in active_profiles if _has_internship_signal(profile))
    insights.append(
        f"{internship_count} of {len(active_profiles)} alumni show an internship step before or during early career growth."
    )

    if family_counter:
        top_family, top_family_count = family_counter.most_common(1)[0]
        insights.append(f"Strongest outcome cluster: {_format_family_label(top_family)} ({top_family_count} alumni).")

    if transition_counter:
        (from_step, to_step), count = transition_counter.most_common(1)[0]
        insights.append(f"Most repeated transition: {from_step} -> {to_step} ({count} times).")

    return insights[:4]


def _build_direction_aggregates(
    scoped_rows: list[tuple[AlumniCareerProfile, bool]]
) -> dict[str, _DirectionAggregate]:
    aggregates: dict[str, _DirectionAggregate] = {}
    for profile, is_public in scoped_rows:
        outcome_role = _extract_current_role(profile)
        if not outcome_role:
            continue
        family = _infer_role_family(outcome_role)
        key = family
        if not key:
            continue
        aggregate = aggregates.setdefault(
            key,
            _DirectionAggregate(
                title=_track_title_for_family(family),
                family=family,
                profiles=[],
                public_profiles=[],
                companies=Counter(),
                skills=Counter(),
                entry_roles=Counter(),
                outcome_roles=Counter(),
                transitions=Counter(),
                representative_paths=[],
            ),
        )
        aggregate.profiles.append(profile)
        if is_public:
            aggregate.public_profiles.append(profile)

        current_company = _extract_current_company(profile)
        if current_company:
            aggregate.companies[current_company] += 1

        entry_role = _extract_entry_role(profile)
        if entry_role:
            aggregate.entry_roles[entry_role] += 1
        aggregate.outcome_roles[outcome_role] += 1

        for transition in _extract_transitions(profile):
            aggregate.transitions[transition] += 1

        for skill in profile.skill_records or []:
            skill_name = _clean(skill.skill_raw)
            if skill_name:
                aggregate.skills[skill_name] += 1

        aggregate.representative_paths.append(_extract_path(profile))

    return aggregates


def _direction_match_score(user_skills: list[str], aggregate: _DirectionAggregate) -> int:
    if not aggregate.profiles:
        return 0

    top_skills = _top_values(aggregate.skills, 6)
    if not user_skills:
        popularity = min(len(aggregate.profiles) / 8, 1.0)
        return round(45 + popularity * 35)

    skill_overlap = len({_normalize_key(skill) for skill in top_skills} & {_normalize_key(skill) for skill in user_skills})
    overlap_ratio = skill_overlap / max(len(top_skills[:4]), 1)
    popularity_bonus = min(len(aggregate.profiles) / 10, 1.0) * 10
    return min(99, round(48 + overlap_ratio * 42 + popularity_bonus))


def _build_real_paths(aggregate: _DirectionAggregate, limit: int = 3) -> list[OpportunityPathRead]:
    items: list[OpportunityPathRead] = []
    source_profiles = aggregate.public_profiles or aggregate.profiles
    for profile in source_profiles[:limit]:
        items.append(
            OpportunityPathRead(
                alumni_user_id=profile.user_id,
                alumni_name=_clean(profile.full_name) or "AITU Alumni",
                headline=_clean(profile.profile_summary),
                path=_extract_path(profile),
            )
        )
    return items


def _build_family_roadmap(
    selected_direction: OpportunityDirectionRead,
    selected_aggregate: _DirectionAggregate | None,
    cohort_label: str,
    user_skills: list[str],
    company_counter: Counter[str],
) -> tuple[list[str], list[str], OpportunityRoadmapRead]:
    role_family = selected_direction.family or _infer_role_family(selected_direction.title)
    blueprint = _blueprint_for_family(role_family)
    user_skill_keys = {_normalize_key(item) for item in user_skills}

    if selected_aggregate:
        common_skills = _top_values(selected_aggregate.skills, 8)
        entry_roles = _top_values(selected_aggregate.entry_roles, 4)
        observed_outcomes = _top_values(selected_aggregate.outcome_roles, 4)
    else:
        common_skills = selected_direction.common_skills
        entry_roles = []
        observed_outcomes = selected_direction.top_outcomes

    strengths = [skill for skill in common_skills if _normalize_key(skill) in user_skill_keys][:4]
    gaps = [skill for skill in common_skills if _normalize_key(skill) not in user_skill_keys][:5]
    foundation_items = (strengths + gaps)[:5] or common_skills[:5] or user_skills[:5]

    roadmap = OpportunityRoadmapRead(
        target_direction_key=selected_direction.key,
        target_direction=selected_direction.title,
        role_family=role_family,
        match_score=selected_direction.match_score,
        rationale=(
            f"{selected_direction.alumni_count} alumni in {cohort_label.lower()} currently contribute to this track. "
            f"Observed outcome titles include {', '.join(observed_outcomes[:3]) or 'role titles from this track'}, "
            f"and the strongest hiring signal comes from {', '.join(selected_direction.top_companies[:3]) or 'leading product teams'}."
        ),
        observed_outcomes=observed_outcomes,
        top_companies=selected_direction.top_companies,
        stages=[
            OpportunityRoadmapStageRead(
                key="foundation",
                title=str(blueprint["foundation_title"]),
                subtitle=str(blueprint["foundation_subtitle"]),
                status="strong" if len(strengths) >= 2 else "build",
                items=foundation_items or ["Build your base signal for this path"],
            ),
            OpportunityRoadmapStageRead(
                key="gap",
                title="Close the Gap",
                subtitle="Missing skills with the highest evidence for this route",
                status="build" if gaps else "ready",
                items=gaps or ["Your current skills already overlap well with this path"],
            ),
            OpportunityRoadmapStageRead(
                key="portfolio",
                title=str(blueprint["portfolio_title"]),
                subtitle="Concrete proof points that make this direction visible",
                status="explore",
                items=list(blueprint["portfolio_items"])[:4],
            ),
            OpportunityRoadmapStageRead(
                key="entry",
                title=str(blueprint["entry_title"]),
                subtitle="Common first stops before alumni reached this role family",
                status="explore",
                items=entry_roles or list(blueprint["next_items"])[:3],
            ),
            OpportunityRoadmapStageRead(
                key="next",
                title=str(blueprint["next_title"]),
                subtitle="Where this roadmap tends to compound over time",
                status="explore",
                items=selected_direction.top_companies or _top_values(company_counter, 4) or list(blueprint["next_items"])[:3],
            ),
        ],
        real_paths=_build_real_paths(selected_aggregate) if selected_aggregate else [],
    )
    return strengths, gaps, roadmap


async def build_opportunities_page(
    current_user: User,
    db: AsyncSession,
    selected_direction_key: str | None = None,
    scope: str | None = None,
    graduation_year: int | None = None,
    requested_interest: str | None = None,
) -> OpportunityPageRead:
    result = await db.execute(
        select(User)
        .options(selectinload(User.profile))
        .where(User.id == current_user.id)
    )
    user = result.scalars().first()
    if not user:
        raise ValueError("User not found")

    if not user.profile:
        user.profile = UserProfile(user_id=user.id)
        db.add(user.profile)
        await db.commit()
        await db.refresh(user.profile)

    if is_opportunity_generation_pending(user.profile):
        pending_state = get_opportunity_generation_state(user.profile)
        raise OpportunityGenerationPendingError(
            pending_state.get("requested_interest") if pending_state else None
        )

    viewer_career_profile = await db.scalar(
        select(AlumniCareerProfile).where(AlumniCareerProfile.user_id == user.id)
    )
    faculty, program = _infer_academic_scope(user, user.profile, viewer_career_profile)

    alumni_result = await db.execute(
        select(AlumniCareerProfile, ResumeImportSession.profile_publish_consent)
        .join(
            ResumeImportSession,
            ResumeImportSession.id == AlumniCareerProfile.source_import_session_id,
        )
        .options(
            selectinload(AlumniCareerProfile.education_records),
            selectinload(AlumniCareerProfile.employment_records),
            selectinload(AlumniCareerProfile.skill_records),
        )
        .where(
            AlumniCareerProfile.confirmed_at.is_not(None),
            ResumeImportSession.graph_analytics_consent.is_(True),
            AlumniCareerProfile.user_id != user.id,
        )
    )
    all_rows = [(profile, bool(is_public)) for profile, is_public in alumni_result.all()]

    available_scopes = ["all"]
    if faculty:
        available_scopes.append("faculty")
    if program:
        available_scopes.append("program")

    scoped_rows = [(profile, is_public) for profile, is_public in all_rows if _match_scope(profile, faculty, program)]
    faculty_rows = [
        (profile, is_public)
        for profile, is_public in all_rows
        if faculty and _normalize_key(profile.faculty_raw) == _normalize_key(faculty)
    ]
    program_rows = [
        (profile, is_public)
        for profile, is_public in all_rows
        if program and _normalize_key(profile.program_raw) == _normalize_key(program)
    ]

    default_scope = "all"
    if program and len(program_rows) >= 3:
        default_scope = "program"
    elif faculty and len(faculty_rows) >= 3:
        default_scope = "faculty"

    current_scope = scope if scope in available_scopes else default_scope
    if current_scope == "program":
        active_rows = program_rows
        cohort_label = f"{program} alumni outcomes"
    elif current_scope == "faculty":
        active_rows = faculty_rows
        cohort_label = f"{faculty} alumni outcomes"
    else:
        active_rows = all_rows
        cohort_label = "AITU alumni outcomes"

    available_years = sorted({profile.graduation_year for profile, _ in active_rows if profile.graduation_year}, reverse=True)
    if graduation_year is not None and graduation_year in available_years:
        active_rows = [(profile, is_public) for profile, is_public in active_rows if profile.graduation_year == graduation_year]
        cohort_label = f"{cohort_label} · class of {graduation_year}"

    active_profiles = [profile for profile, _ in active_rows]
    aggregates = _build_direction_aggregates(active_rows)
    user_skills = _dedupe([_clean(skill) for skill in (user.profile.skills or []) if _clean(skill)])

    directions: list[OpportunityDirectionRead] = []
    for key, aggregate in aggregates.items():
        directions.append(
            OpportunityDirectionRead(
                key=key,
                title=aggregate.title,
                family=aggregate.family,
                alumni_count=len(aggregate.profiles),
                top_companies=_top_values(aggregate.companies, 3),
                common_skills=_top_values(aggregate.skills, 6),
                top_outcomes=_top_values(aggregate.outcome_roles, 3),
                match_score=_direction_match_score(user_skills, aggregate),
                representative_path=aggregate.representative_paths[0] if aggregate.representative_paths else [],
            )
        )

    directions.sort(key=lambda item: (-item.match_score, -item.alumni_count, item.title))
    normalized_interest = _clean(requested_interest) or get_active_custom_interest(user.profile)

    selected_direction = directions[0] if directions else OpportunityDirectionRead(
        key="general-career",
        title="General Career Growth Track",
        family="general",
        alumni_count=0,
        top_companies=[],
        common_skills=[],
        top_outcomes=[],
        match_score=0,
        representative_path=["Astana IT University"],
    )
    if normalized_interest:
        selected_direction = _pick_direction_for_interest(directions, normalized_interest) or selected_direction
    if selected_direction_key:
        requested = next((item for item in directions if item.key == selected_direction_key), None)
        if requested:
            selected_direction = requested

    selected_aggregate = aggregates.get(selected_direction.key)
    company_counter = Counter()
    role_counter = Counter()
    family_counter = Counter()
    transition_counter: Counter[tuple[str, str]] = Counter()
    for aggregate in aggregates.values():
        company_counter.update(aggregate.companies)
        role_counter.update(aggregate.outcome_roles)
        family_counter[aggregate.family] += len(aggregate.profiles)
        transition_counter.update(aggregate.transitions)

    top_roles = _top_values(role_counter, 5)

    if selected_aggregate:
        strengths, gaps, roadmap = _build_family_roadmap(
            selected_direction=selected_direction,
            selected_aggregate=selected_aggregate,
            cohort_label=cohort_label,
            user_skills=user_skills,
            company_counter=company_counter,
        )
    else:
        strengths, gaps, roadmap = _build_family_roadmap(
            selected_direction=selected_direction,
            selected_aggregate=None,
            cohort_label=cohort_label,
            user_skills=user_skills,
            company_counter=company_counter,
        )
        roadmap = OpportunityRoadmapRead(
            target_direction_key=roadmap.target_direction_key,
            target_direction=roadmap.target_direction,
            role_family=roadmap.role_family,
            match_score=roadmap.match_score,
            rationale="We need more confirmed alumni data in this cohort to generate a sharper roadmap.",
            observed_outcomes=roadmap.observed_outcomes,
            top_companies=roadmap.top_companies,
            stages=[
                OpportunityRoadmapStageRead(
                    key="profile",
                    title="Complete Your Signal",
                    subtitle="Add more skills and experience to unlock stronger roadmaps",
                    status="build",
                    items=user_skills[:5] or ["Add skills to your profile", "Import your resume", "Set a target direction"],
                ),
            ],
            real_paths=[],
        )

    if normalized_interest:
        roadmap.target_direction = normalized_interest
        roadmap.rationale = (
            f"You asked us to explore '{normalized_interest}'. "
            f"We mapped it to the closest observed alumni track: {selected_direction.title}. "
            f"{roadmap.rationale}"
        )

    return OpportunityPageRead(
        filters=OpportunityFilterRead(
            current_scope=current_scope,
            available_scopes=available_scopes,
            selected_graduation_year=graduation_year if graduation_year in available_years else None,
            available_graduation_years=available_years[:8],
        ),
        context=OpportunityContextRead(
            user_role=user.role.value if hasattr(user.role, "value") else str(user.role),
            faculty=faculty,
            program=program,
            cohort_label=cohort_label,
            requested_interest=normalized_interest,
            using_custom_interest=bool(normalized_interest),
            current_skills=user_skills,
            strengths=strengths,
            gaps=gaps,
        ),
        market_snapshot=OpportunityMarketSnapshotRead(
            alumni_count=len(active_profiles),
            direction_count=len(directions),
            top_companies=_top_values(company_counter, 5),
            top_roles=top_roles,
            company_chart=_counter_to_chart(company_counter, 6),
            role_chart=_counter_to_chart(role_counter, 6),
            insights=_build_market_insights(active_profiles, transition_counter, family_counter),
        ),
        directions=directions[:6],
        transitions=[
            OpportunityTransitionRead(from_step=from_step, to_step=to_step, count=count)
            for (from_step, to_step), count in transition_counter.most_common(6)
        ],
        roadmap=roadmap,
    )
