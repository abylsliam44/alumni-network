from typing import Any, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.ai.people_recommendations import upsert_user_embedding
from app.core.database import get_db
from app.core import storage
from app.models.user import User, UserProfile
from app.schemas.profile import ProfileRead, ProfileUpdate

router = APIRouter()

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
        )
    return normalized

async def get_profile_data(user: User, db: AsyncSession) -> ProfileRead:
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
    
    # Construct response
    profile_data = {
        "id": user.profile.id,
        "user_id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "is_mentor": user.is_mentor,
        "is_admin": user.is_admin,
        "photo_url": user.photo_url,
        "cover_url": user.profile.cover_url,
        "is_verified": user.is_verified,
        "bio": user.bio,
        "education": user.profile.education or [],
        "experience": _normalize_experience(user.profile.experience),
        "skills": user.profile.skills or [],
        "location": user.profile.location,
        "graduation_year": user.profile.graduation_year,
        "linkedin_url": user.profile.linkedin_url,
        "availability": user.profile.availability,
        "mentor_headline": user.profile.mentor_headline,
        "mentor_areas_of_help": user.profile.mentor_areas_of_help or [],
        "mentor_industries": user.profile.mentor_industries or [],
        "mentor_max_mentees": user.profile.mentor_max_mentees,
        "mentor_availability_note": user.profile.mentor_availability_note,
        "mentor_consent": user.profile.mentor_consent,
    }
    return ProfileRead(**profile_data)

@router.get("/me", response_model=ProfileRead)
async def read_own_profile(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get current user profile
    """
    # Eager load profile
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
    )
    user = result.scalars().first()
    return await get_profile_data(user, db)

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

    # Keep embeddings fresh for recommendations
    await upsert_user_embedding(user, user.profile)
    
    return await get_profile_data(user, db)

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
    )
    user = result.scalars().first()
    return await get_profile_data(user, db)


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
    )
    user = result.scalars().first()
    return await get_profile_data(user, db)

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
    )
    user = result.scalars().first()
    return await get_profile_data(user, db)

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
    )
    user = result.scalars().first()
    return await get_profile_data(user, db)

@router.get("/{user_id}", response_model=ProfileRead)
async def read_user_profile(
    user_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get public profile of specific user
    """
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == user_id)
    )
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return await get_profile_data(user, db)
