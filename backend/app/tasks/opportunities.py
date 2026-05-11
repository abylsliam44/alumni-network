import asyncio
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.cache import invalidate_namespaces
from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.services.opportunities import get_opportunity_generation_state, set_opportunity_generation_state


async def _finalize_interest_generation(user_id: str, requested_interest: str, started_at: str) -> dict:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User)
            .options(selectinload(User.profile))
            .where(User.id == UUID(user_id))
        )
        user = result.scalars().first()
        if not user or not user.profile:
            return {"status": "skipped", "reason": "user_not_found"}

        state = get_opportunity_generation_state(user.profile)
        if not state or state.get("status") != "PENDING":
            return {"status": "skipped", "reason": "not_pending"}
        if state.get("requested_interest") != requested_interest:
            return {"status": "skipped", "reason": "interest_changed"}

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

    await invalidate_namespaces("opportunities", "notifications")
    return {"status": "completed", "user_id": user_id}


@celery_app.task(
    name="app.tasks.opportunities.finalize_interest_generation",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def finalize_interest_generation_task(self, user_id: str, requested_interest: str, started_at: str) -> dict:
    del self
    return asyncio.run(_finalize_interest_generation(user_id, requested_interest, started_at))
