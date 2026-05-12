import logging
import math
from typing import Optional

from app.core.redis import rate_limit_client

logger = logging.getLogger(__name__)


class RateLimitExceeded(Exception):
    def __init__(self, retry_after: int = 60):
        self.retry_after = retry_after


class RateLimitUnavailable(Exception):
    pass


async def check_rate_limit(
    bucket: str,
    identifier: str,
    limit: int,
    window_seconds: int = 60,
    fail_closed: bool = False,
) -> None:
    key = f"v1:rate:{bucket}:{identifier}"
    try:
        client = rate_limit_client()
        current = await client.incr(key)
        if current == 1:
            await client.expire(key, window_seconds)
        if current > limit:
            ttl = await client.ttl(key)
            retry_after = int(ttl if ttl and ttl > 0 else window_seconds)
            raise RateLimitExceeded(retry_after=retry_after)
    except RateLimitExceeded:
        raise
    except Exception as exc:
        logger.exception("Redis rate limiter failed for bucket %s", bucket)
        if fail_closed:
            raise RateLimitUnavailable from exc


def bucket_window_label(window_seconds: int) -> str:
    return f"{math.ceil(window_seconds / 60)}m" if window_seconds >= 60 else f"{window_seconds}s"
