from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api import deps
from app.core.cache import get_json, invalidate_namespaces, make_cache_key, set_json
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.opportunities import (
    OpportunityInterestGenerateRequest,
    OpportunityInterestGenerationRead,
    OpportunityPageRead,
)
from app.services.opportunities import (
    OpportunityGenerationPendingError,
    build_opportunities_page,
    clear_opportunity_generation_state,
    get_active_custom_interest,
    get_opportunity_generation_state,
    is_opportunity_generation_pending,
    set_opportunity_generation_state,
)
from app.tasks.opportunities import finalize_interest_generation_task

router = APIRouter()


async def _ensure_user_with_profile(db: AsyncSession, user_id) -> User:
    result = await db.execute(
        select(User)
        .options(selectinload(User.profile))
        .where(User.id == user_id)
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not user.profile:
        from app.models.user import UserProfile

        user.profile = UserProfile(user_id=user.id)
        db.add(user.profile)
        await db.commit()
        await db.refresh(user.profile)

    return user


@router.get("/me", response_model=OpportunityPageRead)
async def get_my_opportunities(
    direction: str | None = Query(default=None),
    scope: str | None = Query(default=None),
    graduation_year: int | None = Query(default=None),
    interest: str | None = Query(default=None),
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    if current_user.is_admin or current_user.role == UserRole.STAFF:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This page is available only for students and alumni",
        )

    cache_key = make_cache_key(
        "opportunities",
        user_id=current_user.id,
        direction=direction,
        scope=scope,
        graduation_year=graduation_year,
        interest=interest,
    )
    cached = await get_json(cache_key)
    if cached is not None:
        return OpportunityPageRead.model_validate(cached)

    try:
        response = await build_opportunities_page(
            current_user,
            db,
            selected_direction_key=direction,
            scope=scope,
            graduation_year=graduation_year,
            requested_interest=interest,
        )
        await set_json(
            cache_key,
            response.model_dump(mode="json"),
            settings.CACHE_OPPORTUNITIES_TTL_SECONDS,
        )
        return response
    except OpportunityGenerationPendingError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Your roadmap for '{exc.requested_interest}' is still being generated"
                if exc.requested_interest
                else "Your roadmap is still being generated"
            ),
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to build your opportunity roadmap right now",
        ) from exc


@router.post("/interest", response_model=OpportunityInterestGenerationRead, status_code=status.HTTP_202_ACCEPTED)
async def generate_interest_roadmap(
    payload: OpportunityInterestGenerateRequest,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    if current_user.is_admin or current_user.role == UserRole.STAFF:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This page is available only for students and alumni",
        )

    requested_interest = " ".join(payload.interest.split()).strip()
    if not requested_interest:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Interest is required")

    user = await _ensure_user_with_profile(db, current_user.id)
    if is_opportunity_generation_pending(user.profile):
        current_state = get_opportunity_generation_state(user.profile) or {}
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Your roadmap for '{current_state.get('requested_interest')}' is already being generated"
                if current_state.get("requested_interest")
                else "Your roadmap is already being generated"
            ),
        )

    started_at = datetime.utcnow().isoformat()
    set_opportunity_generation_state(
        user.profile,
        status="PENDING",
        requested_interest=requested_interest,
        active_interest=get_active_custom_interest(user.profile),
        started_at=started_at,
        completed_at=None,
    )
    db.add(user.profile)
    await db.commit()

    try:
        finalize_interest_generation_task.apply_async(
            args=[str(user.id), requested_interest, started_at],
            countdown=4,
            queue="opportunities",
        )
    except Exception as exc:
        clear_opportunity_generation_state(user.profile)
        db.add(user.profile)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Opportunity generation queue is unavailable",
        ) from exc

    await invalidate_namespaces("opportunities")

    return OpportunityInterestGenerationRead(
        status="PENDING",
        requested_interest=requested_interest,
        message="Your roadmap generation has started",
    )


@router.delete("/interest", response_model=OpportunityInterestGenerationRead)
async def clear_interest_roadmap(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    if current_user.is_admin or current_user.role == UserRole.STAFF:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This page is available only for students and alumni",
        )

    user = await _ensure_user_with_profile(db, current_user.id)
    if is_opportunity_generation_pending(user.profile):
        current_state = get_opportunity_generation_state(user.profile) or {}
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Your roadmap for '{current_state.get('requested_interest')}' is still being generated"
                if current_state.get("requested_interest")
                else "Your roadmap is still being generated"
            ),
        )

    previous_interest = get_active_custom_interest(user.profile) or "default track"
    clear_opportunity_generation_state(user.profile)
    db.add(user.profile)
    await db.commit()
    await invalidate_namespaces("opportunities")

    return OpportunityInterestGenerationRead(
        status="CLEARED",
        requested_interest=previous_interest,
        message="Custom roadmap preference cleared",
    )
