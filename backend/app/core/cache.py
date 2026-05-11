import hashlib
import json
import logging
from datetime import date, datetime
from enum import Enum
from typing import Any, Awaitable, Callable, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel

from app.core.config import settings
from app.core.redis import cache_client

logger = logging.getLogger(__name__)
T = TypeVar("T")
CACHE_PREFIX = "v1"


def _json_default(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def _normalize(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _normalize(v) for k, v in sorted(value.items(), key=lambda item: str(item[0]))}
    if isinstance(value, (list, tuple, set)):
        return [_normalize(v) for v in value]
    if isinstance(value, (datetime, date, UUID, Enum, BaseModel)):
        return _json_default(value)
    return value


def make_cache_key(namespace: str, *parts: Any, **params: Any) -> str:
    payload = {"parts": _normalize(parts), "params": _normalize(params)}
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=_json_default)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"{CACHE_PREFIX}:{namespace}:{digest}"


async def get_json(key: str) -> Optional[Any]:
    try:
        raw = await cache_client().get(key)
        return json.loads(raw) if raw else None
    except Exception:
        logger.exception("Redis cache read failed for key %s", key)
        return None


async def set_json(key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
    ttl = ttl_seconds or settings.CACHE_DEFAULT_TTL_SECONDS
    try:
        raw = json.dumps(value, sort_keys=True, separators=(",", ":"), default=_json_default)
        await cache_client().set(key, raw, ex=ttl)
    except Exception:
        logger.exception("Redis cache write failed for key %s", key)


async def get_or_set_json(
    key: str,
    ttl_seconds: int,
    loader: Callable[[], Awaitable[T]],
) -> T:
    cached = await get_json(key)
    if cached is not None:
        return cached
    value = await loader()
    await set_json(key, value, ttl_seconds)
    return value


async def delete_keys(*keys: str) -> None:
    if not keys:
        return
    try:
        await cache_client().delete(*keys)
    except Exception:
        logger.exception("Redis cache delete failed")


async def delete_pattern(pattern: str) -> None:
    try:
        client = cache_client()
        keys = [key async for key in client.scan_iter(match=pattern)]
        if keys:
            await client.delete(*keys)
    except Exception:
        logger.exception("Redis cache pattern delete failed for %s", pattern)


async def invalidate_namespaces(*namespaces: str) -> None:
    for namespace in namespaces:
        await delete_pattern(f"{CACHE_PREFIX}:{namespace}:*")
