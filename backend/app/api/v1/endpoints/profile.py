from typing import Any, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.ai.people_recommendations import upsert_user_embedding
from app.core.cache import get_json, invalidate_namespaces, make_cache_key, set_json
from app.core.config import settings
from app.core.database import get_db
from app.core import storage
from app.models.mentorship import MentorFeedback, MentorshipRelationship, MentorshipRelationshipStatus
from app.models.resume import AlumniCareerProfile, ResumeImportSession
from app.models.user import User, UserProfile
from app.schemas.profile import ProfileRead, ProfileUpdate
from app.tasks.recommendations import dispatch_recommendations_prewarm
<<<<<<< HEAD

=======

>>>>>>> origin/main
router = APIRouter()


async def _invalidate_profile_related(user_id: UUID) -> None:
    await invalidate_namespaces("profile", "directory", "recommendations", "opportunities")
    try:
        dispatch_recommendations_prewarm(user_id)
    except Exception:
        pass
<<<<<<< HEAD

def _normalize_experience(raw_exp):
    """
    Cast legacy/seed experience entries into the expected schema shape.
    """
    normalized = []
    for item in raw_exp or []:
        if not isinstance(item, dict):
            continue
        position = item.get("position") or item.get("title") or item.get("role") or ""
        company = item.get("company") or item.get("organization") or ""
        location = item.get("location")
        start_date = item.get("start_date") or item.get("years")
        end_date = item.get("end_date")
        description = item.get("description")
        current = item.get("current", False)

        # Skip completely empty rows
        if not (position or company):
            continue

        normalized.append(
            {
                "position": position,
                "company": company,
                "location": location,
                "start_date": start_date,
                "end_date": end_date,
                "description": description,
                "current": current,
            }
=======

def _normalize_experience(raw_exp):
    """
    Cast legacy/seed experience entries into the expected schema shape.
    """
    normalized = []
    for item in raw_exp or []:
        if not isinstance(item, dict):
            continue
        position = item.get("position") or item.get("title") or item.get("role") or ""
        company = item.get("company") or item.get("organization") or ""
        location = item.get("location")
        start_date = item.get("start_date") or item.get("years")
        end_date = item.get("end_date")
        description = item.get("description")
        current = item.get("current", False)

        # Skip completely empty rows
        if not (position or company):
            continue

        normalized.append(
            {
                "position": position,
                "company": company,
                "location": location,
                "start_date": start_date,
                "end_date": end_date,
                "description": description,
                "current": current,
            }
>>>>>>> origin/main
        )
    return normalized


def _clean_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    compact = " ".join(value.split()).strip()
    return compact or None


def _sort_employment_records(records):
    return sorted(
        records or [],
        key=lambda item: (
            item.start_date or "",
            item.end_date or "",
            item.created_at.isoformat(),
        ),
    )


def _unique_preserving_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(value)
    return result


async def _build_career_profile_data(
    user: User,
    viewer: User | None,
    db: AsyncSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(AlumniCareerProfile)
        .options(
            selectinload(AlumniCareerProfile.education_records),
            selectinload(AlumniCareerProfile.employment_records),
            selectinload(AlumniCareerProfile.skill_records),
        )
        .where(AlumniCareerProfile.user_id == user.id)
    )
    career_profile = result.scalars().first()
    if not career_profile:
        return {}

    is_own_profile = viewer is not None and viewer.id == user.id
    can_publish = False
    if career_profile.source_import_session_id:
        can_publish = bool(
            await db.scalar(
                select(ResumeImportSession.profile_publish_consent).where(
                    ResumeImportSession.id == career_profile.source_import_session_id
                )
            )
        )

    if not is_own_profile and not can_publish:
        return {}

    ordered_employment = _sort_employment_records(career_profile.employment_records)
    companies = _unique_preserving_order(
        [
            company
            for company in (_clean_text(item.company_raw) for item in ordered_employment)
            if company
        ]
    )
    roles = _unique_preserving_order(
        [
            role
            for role in (_clean_text(item.role_raw) for item in ordered_employment)
            if role
        ]
    )

    skills = _unique_preserving_order(
        [
            skill
            for skill in (_clean_text(item.skill_raw) for item in career_profile.skill_records)
            if skill
        ]
    )

    education_records = career_profile.education_records or []
    primary_school = None
    if education_records:
        primary_school = _clean_text(education_records[0].school_name)

    faculty = _clean_text(career_profile.faculty_raw) or next(
        (_clean_text(item.faculty_raw) for item in education_records if _clean_text(item.faculty_raw)),
        None,
    )
    program = _clean_text(career_profile.program_raw) or next(
        (_clean_text(item.program_raw) for item in education_records if _clean_text(item.program_raw)),
        None,
    )
    if faculty and primary_school and faculty.lower() == primary_school.lower():
        faculty = None
    if program and primary_school and program.lower() == primary_school.lower():
        program = None

    path = []
    if primary_school:
        path.append(primary_school)
    elif education_records or faculty or program or career_profile.graduation_year:
        path.append("Astana IT University")

    trajectory = []
    if path:
        trajectory.append(
            {
                "type": "UNIVERSITY",
                "label": path[0],
            }
        )

    for item in ordered_employment:
        company = _clean_text(item.company_raw)
        role = _clean_text(item.role_raw)
        if role and company:
            label = f"{role} at {company}"
        else:
            label = role or company
        if not label:
            continue
        path.append(label)
        trajectory.append(
            {
                "type": "EMPLOYMENT",
                "label": label,
                "company": company,
                "role": role,
                "start_date": item.start_date,
                "end_date": item.end_date,
                "current": item.is_current,
            }
        )

    return {
        "career_university": primary_school or (path[0] if path else None),
        "career_faculty": faculty,
        "career_program": program,
        "career_companies": companies,
        "career_roles": roles,
        "career_projects": [],
        "career_path": path,
        "career_trajectory": trajectory,
        "skills": skills if skills else (user.profile.skills or []),
    }


async def _build_mentee_rating_data(
    user_id: UUID,
    db: AsyncSession,
) -> dict[str, Any]:
    result = await db.execute(
        select(
            func.avg(MentorFeedback.rating).label("avg_rating"),
            func.count(MentorFeedback.id).label("feedback_count"),
        ).where(MentorFeedback.mentee_id == user_id)
    )
    avg_rating, feedback_count = result.one()
    count = int(feedback_count or 0)
    return {
        "mentee_average_rating": round(float(avg_rating), 2) if avg_rating is not None else None,
        "mentee_feedback_count": count,
    }

async def get_profile_data(user: User, db: AsyncSession, viewer: User | None = None) -> ProfileRead:
<<<<<<< HEAD
    # Reload with profile eagerly to avoid MissingGreenlet on lazy load
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == user.id)
    )
    user = result.scalars().first()

    # Ensure profile exists
    if not user.profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
        user.profile = profile
        # Reload to keep relationship in sync
        result = await db.execute(
            select(User).options(selectinload(User.profile)).where(User.id == user.id)
        )
        user = result.scalars().first()
    
=======
    # Reload with profile eagerly to avoid MissingGreenlet on lazy load
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == user.id)
    )
    user = result.scalars().first()

    # Ensure profile exists
    if not user.profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
        user.profile = profile
        # Reload to keep relationship in sync
        result = await db.execute(
            select(User).options(selectinload(User.profile)).where(User.id == user.id)
        )
        user = result.scalars().first()
    
>>>>>>> origin/main
    is_own_profile = viewer is not None and viewer.id == user.id
    can_view_private = is_own_profile or bool(viewer and viewer.is_admin)

    career_profile_data = await _build_career_profile_data(user, viewer, db)
    mentee_rating_data = await _build_mentee_rating_data(user.id, db)
    mentor_active_mentees = 0
    mentor_capacity_status = None
    if user.is_mentor:
        mentor_active_mentees = await db.scalar(
            select(func.count(MentorshipRelationship.id)).where(
                MentorshipRelationship.mentor_id == user.id,
                MentorshipRelationship.status == MentorshipRelationshipStatus.ACTIVE,
            )
        ) or 0
        max_mentees = user.profile.mentor_max_mentees
        if max_mentees and max_mentees > 0:
            if mentor_active_mentees >= max_mentees:
                mentor_capacity_status = "FULL"
            elif mentor_active_mentees >= max_mentees - 1:
                mentor_capacity_status = "LIMITED"
            else:
                mentor_capacity_status = "AVAILABLE"
        else:
            mentor_capacity_status = "AVAILABLE"

    # Construct response
    profile_data = {
        "id": user.profile.id,
        "user_id": user.id,
        "email": user.email if can_view_private else None,
        "name": user.name,
        "role": user.role,
        "is_mentor": user.is_mentor,
        "is_admin": user.is_admin if can_view_private else False,
<<<<<<< HEAD
        "photo_url": user.photo_url,
        "cover_url": user.profile.cover_url,
        "is_verified": user.is_verified,
        "bio": user.bio,
        "education": user.profile.education or [],
        "experience": _normalize_experience(user.profile.experience),
        "skills": career_profile_data.get("skills", user.profile.skills or []),
        "location": user.profile.location,
        "graduation_year": user.profile.graduation_year,
        "linkedin_url": user.profile.linkedin_url,
        "github_url": user.profile.github_url,
        "website_url": user.profile.website_url,
        "headline": user.profile.headline,
        "availability": user.profile.availability,
        "mentor_headline": user.profile.mentor_headline,
        "mentor_areas_of_help": user.profile.mentor_areas_of_help or [],
        "mentor_industries": user.profile.mentor_industries or [],
=======
        "photo_url": user.photo_url,
        "cover_url": user.profile.cover_url,
        "is_verified": user.is_verified,
        "bio": user.bio,
        "education": user.profile.education or [],
        "experience": _normalize_experience(user.profile.experience),
        "skills": career_profile_data.get("skills", user.profile.skills or []),
        "location": user.profile.location,
        "graduation_year": user.profile.graduation_year,
        "linkedin_url": user.profile.linkedin_url,
        "github_url": user.profile.github_url,
        "website_url": user.profile.website_url,
        "headline": user.profile.headline,
        "availability": user.profile.availability,
        "mentor_headline": user.profile.mentor_headline,
        "mentor_areas_of_help": user.profile.mentor_areas_of_help or [],
        "mentor_industries": user.profile.mentor_industries or [],
>>>>>>> origin/main
        "mentor_max_mentees": user.profile.mentor_max_mentees,
        "mentor_availability_note": user.profile.mentor_availability_note,
        "mentor_consent": user.profile.mentor_consent,
        "mentor_active_mentees": mentor_active_mentees,
        "mentor_capacity_status": mentor_capacity_status,
        "career_university": career_profile_data.get("career_university"),
        "career_faculty": career_profile_data.get("career_faculty"),
        "career_program": career_profile_data.get("career_program"),
        "career_companies": career_profile_data.get("career_companies", []),
        "career_roles": career_profile_data.get("career_roles", []),
        "career_projects": career_profile_data.get("career_projects", []),
        "career_path": career_profile_data.get("career_path", []),
        "career_trajectory": career_profile_data.get("career_trajectory", []),
        "mentee_average_rating": mentee_rating_data.get("mentee_average_rating"),
        "mentee_feedback_count": mentee_rating_data.get("mentee_feedback_count", 0),
        "opportunity_generation": (
            user.profile.visibility_settings.get("opportunity_generation")
            if can_view_private and isinstance(user.profile.visibility_settings, dict)
            else None
        ),
    }
    return ProfileRead(**profile_data)
<<<<<<< HEAD

@router.get("/me", response_model=ProfileRead)
async def read_own_profile(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
=======

@router.get("/me", response_model=ProfileRead)
async def read_own_profile(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
>>>>>>> origin/main
    """
    Get current user profile
    """
    cache_key = make_cache_key("profile", user_id=current_user.id, viewer_id=current_user.id, own=True)
    cached = await get_json(cache_key)
    if cached is not None:
        return ProfileRead.model_validate(cached)

    # Eager load profile
<<<<<<< HEAD
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
    )
    user = result.scalars().first()
    response = await get_profile_data(user, db, viewer=current_user)
    await set_json(cache_key, response.model_dump(mode="json"), settings.CACHE_PROFILE_TTL_SECONDS)
    return response

@router.put("/me", response_model=ProfileRead)
async def update_own_profile(
    profile_in: ProfileUpdate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Update current user profile
    """
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
    )
    user = result.scalars().first()
    
    # Update User fields
    if profile_in.name is not None:
        user.name = profile_in.name
    if profile_in.bio is not None:
        user.bio = profile_in.bio
    if profile_in.photo_url is not None:
        user.photo_url = profile_in.photo_url
        
    # Update UserProfile fields
    if user.profile is None:
        user.profile = UserProfile(user_id=user.id)
        db.add(user.profile)
        
    profile_data = profile_in.dict(exclude={"name", "photo_url", "bio"}, exclude_unset=True)
    
    for field, value in profile_data.items():
        if hasattr(user.profile, field):
            setattr(user.profile, field, value)
            
    db.add(user)
    db.add(user.profile)
    await db.commit()
    
    # Re-fetch user with profile to avoid MissingGreenlet error on lazy load
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
    )
    user = result.scalars().first()

=======
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
    )
    user = result.scalars().first()
    response = await get_profile_data(user, db, viewer=current_user)
    await set_json(cache_key, response.model_dump(mode="json"), settings.CACHE_PROFILE_TTL_SECONDS)
    return response

@router.put("/me", response_model=ProfileRead)
async def update_own_profile(
    profile_in: ProfileUpdate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Update current user profile
    """
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
    )
    user = result.scalars().first()
    
    # Update User fields
    if profile_in.name is not None:
        user.name = profile_in.name
    if profile_in.bio is not None:
        user.bio = profile_in.bio
    if profile_in.photo_url is not None:
        user.photo_url = profile_in.photo_url
        
    # Update UserProfile fields
    if user.profile is None:
        user.profile = UserProfile(user_id=user.id)
        db.add(user.profile)
        
    profile_data = profile_in.dict(exclude={"name", "photo_url", "bio"}, exclude_unset=True)
    
    for field, value in profile_data.items():
        if hasattr(user.profile, field):
            setattr(user.profile, field, value)
            
    db.add(user)
    db.add(user.profile)
    await db.commit()
    
    # Re-fetch user with profile to avoid MissingGreenlet error on lazy load
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
    )
    user = result.scalars().first()

>>>>>>> origin/main
    # Keep embeddings fresh for recommendations
    await upsert_user_embedding(user, user.profile)
    await _invalidate_profile_related(current_user.id)
    
    return await get_profile_data(user, db, viewer=current_user)
<<<<<<< HEAD

@router.patch("/me/photo", response_model=ProfileRead)
async def upload_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Upload profile photo
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, detail="File must be an image")
        
    file_url = await storage.save_upload_file(file, sub_dir="avatars")
    
    current_user.photo_url = file_url
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    
    # Reload with profile
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
=======

@router.patch("/me/photo", response_model=ProfileRead)
async def upload_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Upload profile photo
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, detail="File must be an image")
        
    file_url = await storage.save_upload_file(file, sub_dir="avatars")
    
    current_user.photo_url = file_url
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    
    # Reload with profile
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
>>>>>>> origin/main
    )
    user = result.scalars().first()
    await _invalidate_profile_related(current_user.id)
    return await get_profile_data(user, db, viewer=current_user)
<<<<<<< HEAD


@router.patch("/me/cover", response_model=ProfileRead)
async def upload_cover(
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Upload profile cover image
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, detail="File must be an image")

    file_url = await storage.save_upload_file(file, sub_dir="covers")

    # Ensure profile exists
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
    )
    user = result.scalars().first()
    if user.profile is None:
        user.profile = UserProfile(user_id=user.id)

    user.profile.cover_url = file_url
    db.add(user.profile)
    await db.commit()
    await db.refresh(user.profile)

    # Reload user with profile to avoid lazy load
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
=======


@router.patch("/me/cover", response_model=ProfileRead)
async def upload_cover(
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Upload profile cover image
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, detail="File must be an image")

    file_url = await storage.save_upload_file(file, sub_dir="covers")

    # Ensure profile exists
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
    )
    user = result.scalars().first()
    if user.profile is None:
        user.profile = UserProfile(user_id=user.id)

    user.profile.cover_url = file_url
    db.add(user.profile)
    await db.commit()
    await db.refresh(user.profile)

    # Reload user with profile to avoid lazy load
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
>>>>>>> origin/main
    )
    user = result.scalars().first()
    await _invalidate_profile_related(current_user.id)
    return await get_profile_data(user, db, viewer=current_user)
<<<<<<< HEAD

@router.delete("/me/photo", response_model=ProfileRead)
async def delete_photo(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Delete profile photo
    """
    current_user.photo_url = None
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    
    # Reload with profile
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
=======

@router.delete("/me/photo", response_model=ProfileRead)
async def delete_photo(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Delete profile photo
    """
    current_user.photo_url = None
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    
    # Reload with profile
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
>>>>>>> origin/main
    )
    user = result.scalars().first()
    await _invalidate_profile_related(current_user.id)
    return await get_profile_data(user, db, viewer=current_user)
<<<<<<< HEAD

@router.delete("/me/cover", response_model=ProfileRead)
async def delete_cover(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Delete profile cover image
    """
    # Ensure profile exists
    if current_user.profile:
        current_user.profile.cover_url = None
        db.add(current_user.profile)
        await db.commit()
        await db.refresh(current_user.profile)

    # Reload user with profile
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
=======

@router.delete("/me/cover", response_model=ProfileRead)
async def delete_cover(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Delete profile cover image
    """
    # Ensure profile exists
    if current_user.profile:
        current_user.profile.cover_url = None
        db.add(current_user.profile)
        await db.commit()
        await db.refresh(current_user.profile)

    # Reload user with profile
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
>>>>>>> origin/main
    )
    user = result.scalars().first()
    await _invalidate_profile_related(current_user.id)
    return await get_profile_data(user, db, viewer=current_user)
<<<<<<< HEAD

@router.get("/{user_id}", response_model=ProfileRead)
async def read_user_profile(
    user_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
=======

@router.get("/{user_id}", response_model=ProfileRead)
async def read_user_profile(
    user_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
>>>>>>> origin/main
    """
    Get public profile of specific user
    """
    cache_key = make_cache_key(
        "profile",
        user_id=user_id,
        viewer_id=current_user.id,
        viewer_is_admin=current_user.is_admin,
    )
    cached = await get_json(cache_key)
    if cached is not None:
        return ProfileRead.model_validate(cached)

    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == user_id)
    )
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    response = await get_profile_data(user, db, viewer=current_user)
    await set_json(cache_key, response.model_dump(mode="json"), settings.CACHE_PROFILE_TTL_SECONDS)
    return response
