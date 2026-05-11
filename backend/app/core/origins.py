from typing import Optional

from starlette.datastructures import Headers

from app.core.config import settings


DEFAULT_DEV_ORIGINS = {
    "http://localhost:3000",
    "http://frontend:3000",
    "http://localhost:3030",
    "http://frontend:3030",
    "http://0.0.0.0:3000",
    "http://0.0.0.0:3030",
}


def _normalize_origin(origin: Optional[str]) -> Optional[str]:
    if not origin:
        return None
    return origin.strip().rstrip("/")


def _current_origin(headers: Headers, scheme: str) -> Optional[str]:
    host = headers.get("x-forwarded-host") or headers.get("host")
    if not host:
        return None
    proto = headers.get("x-forwarded-proto") or scheme
    if proto in {"ws", "wss"}:
        proto = "https" if proto == "wss" else "http"
    return _normalize_origin(f"{proto}://{host}")


def _is_dev_origin(origin: Optional[str]) -> bool:
    return bool(origin and any(host in origin for host in ("localhost", "0.0.0.0", "frontend", "backend")))


def allowed_origins(headers: Headers, scheme: str) -> set[str]:
    configured_origins = {
        normalized
        for origin in settings.BACKEND_CORS_ORIGINS
        if (normalized := _normalize_origin(str(origin)))
    }
    origins = set(configured_origins)
    current = _current_origin(headers, scheme)
    if current:
        origins.add(current)
    if not configured_origins and _is_dev_origin(current):
        origins.update(DEFAULT_DEV_ORIGINS)
    return origins


def is_allowed_origin(origin: Optional[str], headers: Headers, scheme: str) -> bool:
    normalized = _normalize_origin(origin)
    if not normalized:
        return True
    return normalized in allowed_origins(headers, scheme)
