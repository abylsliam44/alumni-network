from typing import Any, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.core import storage
from app.models.user import User, UserProfile
from app.schemas.profile import ProfileRead, ProfileUpdate

router = APIRouter()

async def get_profile_data(user: User, db: AsyncSession) -> ProfileRead:
    # Ensure profile exists
    if not user.profile:
        # Should have been created at registration, but just in case
        result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
        profile = result.scalars().first()
        if not profile:
            profile = UserProfile(user_id=user.id)
            db.add(profile)
            await db.commit()
            await db.refresh(profile)
        user.profile = profile
    
    # Construct response
    profile_data = {
        "id": user.profile.id,
        "user_id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "photo_url": user.photo_url,
        "is_verified": user.is_verified,
        "bio": user.bio,
        "education": user.profile.education or [],
        "experience": user.profile.experience or [],
        "skills": user.profile.skills or [],
        "location": user.profile.location,
        "graduation_year": user.profile.graduation_year,
        "linkedin_url": user.profile.linkedin_url,
        "availability": user.profile.availability,
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
