from datetime import datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.people_recommendations import run_people_recommendations_agent, upsert_user_embedding
from app.api import deps
from app.core.cache import get_json, make_cache_key, set_json
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.recommendations import PeopleRecommendationsResponse

router = APIRouter()


@router.get("/people", response_model=PeopleRecommendationsResponse)
async def get_people_recommendations(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    cache_key = make_cache_key("recommendations", user_id=current_user.id)
    cached = await get_json(cache_key)
    if cached is not None:
        return PeopleRecommendationsResponse.model_validate(cached)

    try:
        response = await run_people_recommendations_agent(current_user.id, db)
        await set_json(
            cache_key,
            response.model_dump(mode="json"),
            settings.CACHE_RECOMMENDATIONS_TTL_SECONDS,
        )
        return response
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to generate recommendations right now",
        ) from exc


@router.post("/internal/ai/reindex_users")
async def reindex_users(
    current_user: User = Depends(deps.require_admin),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Rebuild embeddings for all users. Admin-only.
    """
    result = await db.execute(select(User).options(selectinload(User.profile)))
    users = result.scalars().all()
    processed = 0
    for user in users:
        if not user.profile:
            continue
        await upsert_user_embedding(user, user.profile)
        processed += 1

    return {
        "processed": processed,
        "timestamp": datetime.utcnow().isoformat(),
    }
