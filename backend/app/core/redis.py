import logging
from functools import lru_cache

from redis import asyncio as redis

from app.core.config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def cache_client() -> redis.Redis:
    return redis.from_url(settings.REDIS_CACHE_URL, decode_responses=True)


@lru_cache(maxsize=1)
def pubsub_client() -> redis.Redis:
    return redis.from_url(settings.REDIS_PUBSUB_URL, decode_responses=True)


@lru_cache(maxsize=1)
def rate_limit_client() -> redis.Redis:
    return redis.from_url(settings.REDIS_RATE_LIMIT_URL, decode_responses=True)


async def close_redis_clients() -> None:
    for client_factory in (cache_client, pubsub_client, rate_limit_client):
        try:
            await client_factory().aclose()
        except Exception:
            logger.exception("Failed to close Redis client")
