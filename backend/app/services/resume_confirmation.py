from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.people_recommendations import upsert_user_embedding
from app.core.cache import invalidate_namespaces
from app.models.resume import (
    AlumniCareerProfile,
    AlumniEducationRecord,
    AlumniEmploymentRecord,
    AlumniSkillRecord,
    CareerGraphEdge,
    ResumeConfirmationStatus,
    ResumeImportSession,
)
from app.models.user import User, UserProfile
from app.services.career_graph import rebuild_career_graph_for_profile
from app.tasks.recommendations import dispatch_recommendations_prewarm

EMBEDDING_UPSERT_TIMEOUT_SECONDS = 15.0


def _clean_text(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        return str(value)
    normalized = " ".join(value.split()).strip()
    return normalized or None


def _extract_identity_value(identity: dict[str, Any], key: str) -> Any:
    value = identity.get(key)
    if isinstance(value, dict):
        return value.get("value")
    return value


def _extract_item_confidence(item: dict[str, Any]) -> float | None:
    confidence = item.get("confidence")
    try:
        return float(confidence) if confidence is not None else None
    except (TypeError, ValueError):
        return None


def _build_profile_headline(current_role: str | None, current_company: str | None) -> str | None:
    if current_role and current_company:
        return f"{current_role} at {current_company}"
    return current_role or current_company


async def _get_or_create_career_profile(
    db: AsyncSession,
    user_id: UUID,
) -> AlumniCareerProfile:
    profile = await db.scalar(
        select(AlumniCareerProfile).where(AlumniCareerProfile.user_id == user_id)
    )
    if profile:
        return profile

    profile = AlumniCareerProfile(user_id=user_id)
    db.add(profile)
    await db.flush()
    return profile


async def save_resume_draft_edits(
    db: AsyncSession,
    session: ResumeImportSession,
    draft_json: dict[str, Any] | None,
    normalized_json: dict[str, Any] | None,
    field_confidences: dict[str, Any] | None,
) -> ResumeImportSession:
    if not session.draft:
        raise ValueError("Resume draft not found")

    has_changes = False

    if draft_json is not None:
        has_changes = has_changes or draft_json != (session.draft.draft_json or {})
        session.draft.draft_json = draft_json
    if normalized_json is not None:
        has_changes = has_changes or normalized_json != (session.draft.normalized_json or {})
        session.draft.normalized_json = normalized_json
    if field_confidences is not None:
        has_changes = has_changes or field_confidences != (session.draft.field_confidences or {})
        session.draft.field_confidences = field_confidences

    if has_changes:
        session.last_reviewed_at = datetime.utcnow()
        session.confirmation_status = ResumeConfirmationStatus.NEEDS_REVIEW

    db.add(session.draft)
    db.add(session)
    await db.commit()

    result = await db.execute(
        select(ResumeImportSession)
        .options(
            selectinload(ResumeImportSession.document),
            selectinload(ResumeImportSession.jobs),
            selectinload(ResumeImportSession.draft),
        )
        .where(ResumeImportSession.id == session.id)
    )
    return result.scalars().first()


async def confirm_resume_import(
    db: AsyncSession,
    session: ResumeImportSession,
    current_user: User,
    profile_publish_consent: bool | None = None,
    graph_analytics_consent: bool | None = None,
) -> ResumeImportSession:
    if not session.draft:
        raise ValueError("Resume draft not found")

    if profile_publish_consent is not None:
        session.profile_publish_consent = profile_publish_consent
    if graph_analytics_consent is not None:
        session.graph_analytics_consent = graph_analytics_consent

    source = session.draft.normalized_json or session.draft.draft_json or {}
    identity = source.get("identity") or {}
    education_items = source.get("education") or []
    employment_items = source.get("employment") or []
    skill_items = source.get("skills") or []

    career_profile = await _get_or_create_career_profile(db, current_user.id)
    career_profile.source_import_session_id = session.id
    career_profile.source_document_id = session.resume_document_id
    career_profile.full_name = _clean_text(_extract_identity_value(identity, "full_name")) or current_user.name
    career_profile.faculty_raw = _clean_text(_extract_identity_value(identity, "faculty"))
    career_profile.program_raw = _clean_text(_extract_identity_value(identity, "program"))

    graduation_year = _extract_identity_value(identity, "graduation_year")
    try:
        career_profile.graduation_year = int(graduation_year) if graduation_year else None
    except (TypeError, ValueError):
        career_profile.graduation_year = None

    career_profile.current_company_raw = _clean_text(_extract_identity_value(identity, "current_company"))
    career_profile.current_role_raw = _clean_text(_extract_identity_value(identity, "current_role"))
    career_profile.profile_summary = _build_profile_headline(
        career_profile.current_role_raw,
        career_profile.current_company_raw,
    )
    career_profile.confidence_score = None
    career_profile.confirmed_at = datetime.utcnow()
    career_profile.last_verified_at = datetime.utcnow()
    db.add(career_profile)
    await db.flush()

    await db.execute(
        delete(AlumniEducationRecord).where(AlumniEducationRecord.career_profile_id == career_profile.id)
    )
    await db.execute(
        delete(AlumniEmploymentRecord).where(AlumniEmploymentRecord.career_profile_id == career_profile.id)
    )
    await db.execute(
        delete(AlumniSkillRecord).where(AlumniSkillRecord.career_profile_id == career_profile.id)
    )

    for item in education_items:
        if not isinstance(item, dict):
            continue
        school = _clean_text(item.get("school"))
        if not school:
            continue
        db.add(
            AlumniEducationRecord(
                career_profile_id=career_profile.id,
                school_name=school,
                degree=_clean_text(item.get("degree")),
                faculty_raw=_clean_text(item.get("faculty")),
                program_raw=_clean_text(item.get("program")),
                field_of_study=_clean_text(item.get("field_of_study")),
                start_date=_clean_text(item.get("start_date")),
                end_date=_clean_text(item.get("end_date")),
                description=_clean_text(item.get("description")),
                confidence_score=_extract_item_confidence(item),
                confirmed_at=career_profile.confirmed_at,
                last_verified_at=career_profile.last_verified_at,
            )
        )

    for item in employment_items:
        if not isinstance(item, dict):
            continue
        company = _clean_text(item.get("company"))
        if not company:
            continue
        db.add(
            AlumniEmploymentRecord(
                career_profile_id=career_profile.id,
                company_raw=company,
                role_raw=_clean_text(item.get("role")),
                start_date=_clean_text(item.get("start_date")),
                end_date=_clean_text(item.get("end_date")),
                location=_clean_text(item.get("location")),
                description=_clean_text(item.get("description")),
                is_current=bool(item.get("is_current", False)),
                confidence_score=_extract_item_confidence(item),
                confirmed_at=career_profile.confirmed_at,
                last_verified_at=career_profile.last_verified_at,
            )
        )

    seen_skills: set[str] = set()
    for item in skill_items:
        if not isinstance(item, dict):
            continue
        skill = _clean_text(item.get("name"))
        if not skill or skill in seen_skills:
            continue
        seen_skills.add(skill)
        db.add(
            AlumniSkillRecord(
                career_profile_id=career_profile.id,
                skill_raw=skill,
                confidence_score=_extract_item_confidence(item),
                confirmed_at=career_profile.confirmed_at,
                last_verified_at=career_profile.last_verified_at,
            )
        )

    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
    )
    user = result.scalars().first()
    if not user:
        raise ValueError("User not found")

    if user.profile is None:
        user.profile = UserProfile(user_id=user.id)
        db.add(user.profile)
        await db.flush()

    if session.profile_publish_consent:
        user.name = career_profile.full_name or user.name
        user.profile.graduation_year = career_profile.graduation_year
        user.profile.headline = career_profile.profile_summary
        user.profile.skills = sorted(seen_skills)
        user.profile.education = [
            {
                "school": _clean_text(item.get("school")) or "",
                "degree": _clean_text(item.get("degree")) or "",
                "field_of_study": _clean_text(item.get("field_of_study")),
                "start_date": _clean_text(item.get("start_date")),
                "end_date": _clean_text(item.get("end_date")),
                "description": _clean_text(item.get("description")),
                "current": False,
            }
            for item in education_items
            if isinstance(item, dict) and _clean_text(item.get("school"))
        ]
        user.profile.experience = [
            {
                "company": _clean_text(item.get("company")) or "",
                "position": _clean_text(item.get("role")) or "",
                "location": _clean_text(item.get("location")),
                "start_date": _clean_text(item.get("start_date")),
                "end_date": _clean_text(item.get("end_date")),
                "description": _clean_text(item.get("description")),
                "current": bool(item.get("is_current", False)),
            }
            for item in employment_items
            if isinstance(item, dict) and _clean_text(item.get("company"))
        ]

    session.confirmation_status = ResumeConfirmationStatus.CONFIRMED
    session.last_confirmed_at = datetime.utcnow()
    session.last_reviewed_at = datetime.utcnow()

    await db.flush()

    graph_result = await db.execute(
        select(AlumniCareerProfile)
        .options(
            selectinload(AlumniCareerProfile.education_records),
            selectinload(AlumniCareerProfile.employment_records),
            selectinload(AlumniCareerProfile.skill_records),
        )
        .where(AlumniCareerProfile.id == career_profile.id)
    )
    hydrated_profile = graph_result.scalars().first()

    if session.graph_analytics_consent and hydrated_profile:
        await rebuild_career_graph_for_profile(db, hydrated_profile)
    else:
        await db.execute(
            delete(CareerGraphEdge).where(CareerGraphEdge.alumni_user_id == current_user.id)
        )

    if session.profile_publish_consent:
        try:
            await asyncio.wait_for(
                upsert_user_embedding(user, user.profile),
                timeout=EMBEDDING_UPSERT_TIMEOUT_SECONDS,
            )
        except Exception:
            # Embedding refresh is a best-effort side effect and must not block
            # resume confirmation, which establishes the confirmed source of truth.
            pass

    await db.commit()
    await invalidate_namespaces("profile", "directory", "recommendations", "opportunities")
    try:
        dispatch_recommendations_prewarm(current_user.id)
    except Exception:
        pass

    final_result = await db.execute(
        select(ResumeImportSession)
        .options(
            selectinload(ResumeImportSession.document),
            selectinload(ResumeImportSession.jobs),
            selectinload(ResumeImportSession.draft),
        )
        .where(ResumeImportSession.id == session.id)
    )
    return final_result.scalars().first()
