import asyncio
from uuid import UUID

from app.core.cache import make_cache_key, set_json
from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import TaskSessionLocal


async def _prewarm_people_recommendations(user_id: str) -> dict:
    # Lazy import — keeps the heavy AI/Qdrant stack out of the API workers,
    # which only need this module to dispatch tasks.
    from app.ai.people_recommendations import run_people_recommendations_agent

    async with TaskSessionLocal() as db:
        response = await run_people_recommendations_agent(UUID(user_id), db)
        cache_key = make_cache_key("recommendations", user_id=user_id)
        await set_json(
            cache_key,
            response.model_dump(mode="json"),
            settings.CACHE_RECOMMENDATIONS_TTL_SECONDS,
        )
    return {"status": "cached", "user_id": user_id}


def dispatch_recommendations_prewarm(user_id) -> None:
    prewarm_people_recommendations_task.apply_async(args=[str(user_id)], queue="recommendations")


@celery_app.task(
    name="app.tasks.recommendations.prewarm_people_recommendations",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def prewarm_people_recommendations_task(self, user_id: str) -> dict:
    del self
    return asyncio.run(_prewarm_people_recommendations(user_id))
