import asyncio
from datetime import datetime
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api import deps
from app.core.database import AsyncSessionLocal, get_db
from app.models.notification import Notification, NotificationType
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


async def _finalize_interest_generation(user_id, requested_interest: str, started_at: str | None) -> None:
    await asyncio.sleep(4)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User)
            .options(selectinload(User.profile))
            .where(User.id == user_id)
        )
        user = result.scalars().first()
        if not user or not user.profile:
            return

        state = get_opportunity_generation_state(user.profile)
        if not state or state.get("status") != "PENDING":
            return
        if state.get("requested_interest") != requested_interest:
            return

        set_opportunity_generation_state(
            user.profile,
            status="COMPLETED",
            requested_interest=requested_interest,
            active_interest=requested_interest,
            started_at=started_at,
            completed_at=datetime.utcnow().isoformat(),
        )
        db.add(user.profile)
        db.add(
            Notification(
                user_id=user.id,
                type=NotificationType.EVENT_APPROVED,
                title="Roadmap Ready",
                message=f"Your roadmap for '{requested_interest}' is ready. Open Find Opportunities to review it.",
            )
        )
        await db.commit()


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

    try:
        return await build_opportunities_page(
            current_user,
            db,
            selected_direction_key=direction,
            scope=scope,
            graduation_year=graduation_year,
            requested_interest=interest,
        )
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
    background_tasks: BackgroundTasks,
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

    background_tasks.add_task(_finalize_interest_generation, user.id, requested_interest, started_at)

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

    return OpportunityInterestGenerationRead(
        status="CLEARED",
        requested_interest=previous_interest,
        message="Custom roadmap preference cleared",
    )
