from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.api import deps
from app.core.cache import get_json, make_cache_key, set_json
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.profile import ProfileRead
from app.services.search import SearchService
from app.api.v1.endpoints.profile import get_profile_data

router = APIRouter()

class DirectoryResponse(BaseModel):
    items: List[ProfileRead]
    total: int
    page: int
    limit: int
    pages: int

@router.get("/", response_model=DirectoryResponse)
async def list_users(
    query: Optional[str] = None,
    role: Optional[UserRole] = None,
    is_mentor: Optional[bool] = Query(None, description="Filter mentors only"),
    skills: Optional[str] = Query(None, description="Comma separated skills"),
    location: Optional[str] = None,
    graduation_year: Optional[int] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Search and list users in the directory
    """
    skill_list = [s.strip() for s in skills.split(",")] if skills else None
    cache_key = make_cache_key(
        "directory",
        viewer_id=current_user.id,
        viewer_is_admin=current_user.is_admin,
        query=query,
        role=role,
        is_mentor=is_mentor,
        skills=skill_list,
        location=location,
        graduation_year=graduation_year,
        page=page,
        limit=limit,
    )
    cached = await get_json(cache_key)
    if cached is not None:
        return DirectoryResponse.model_validate(cached)
    
    users, total = await SearchService.search_users(
        db=db,
        query=query,
        role=role,
        is_mentor=is_mentor,
        skills=skill_list,
        location=location,
        graduation_year=graduation_year,
        page=page,
        limit=limit
    )
    
    # Convert to ProfileRead
    # We need to ensure profile data is loaded. SearchService uses selectinload, so it should be.
    # But get_profile_data handles missing profiles too.
    items = []
    for user in users:
        # We can reuse get_profile_data logic but it might be slow to do individual queries if profile is missing
        # But SearchService joins UserProfile, so user.profile should be populated (or None)
        # We'll manually construct ProfileRead to avoid N+1 if get_profile_data does extra checks
        # Actually get_profile_data does a check if user.profile is None.
        # Let's just use it, assuming profiles exist for most.
        item = await get_profile_data(user, db, viewer=current_user)
        items.append(item)
        
    import math
    pages = math.ceil(total / limit)
    
    response = DirectoryResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages
    )
    await set_json(cache_key, response.model_dump(mode="json"), settings.CACHE_DIRECTORY_TTL_SECONDS)
    return response
