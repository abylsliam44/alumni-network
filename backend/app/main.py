import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import JSONResponse

from contextlib import asynccontextmanager

from app.api import ws
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.origins import is_allowed_origin
from app.core.rate_limit import RateLimitExceeded, RateLimitUnavailable, check_rate_limit
from app.core.redis import close_redis_clients
from app.core.security import verify_token


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start WS pub/sub listener so broadcasts span uvicorn workers.
    await ws.manager.start_pubsub()
    try:
        yield
    finally:
        await ws.manager.stop_pubsub()
        await close_redis_clients()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.ENABLE_OPENAPI else None,
    docs_url="/docs" if settings.ENABLE_OPENAPI else None,
    redoc_url="/redoc" if settings.ENABLE_OPENAPI else None,
    # Handle X-Forwarded-Proto from nginx for correct redirect URLs
    root_path="" if not os.getenv("ROOT_PATH") else os.getenv("ROOT_PATH"),
    lifespan=lifespan,
)

# Mount static files
upload_dir = Path(settings.UPLOAD_DIR).resolve()
if not upload_dir.exists():
    upload_dir.mkdir(parents=True, exist_ok=True)
    
app.mount("/static", StaticFiles(directory=str(upload_dir)), name="static")

# CORS configuration
# Use env-provided origins when available, otherwise fall back to common local/dev hosts.
default_cors_origins = [
    "http://localhost:3000",
    "http://frontend:3000",
    "http://localhost:3030",
    "http://frontend:3030",
    "http://0.0.0.0:3000",
    "http://0.0.0.0:3030",
]
# Normalize env-provided origins and fall back to defaults when empty/blank
raw_env_origins = settings.BACKEND_CORS_ORIGINS
if isinstance(raw_env_origins, str):
    env_origins = [origin.strip() for origin in raw_env_origins.split(",") if origin.strip()]
else:
    env_origins = [str(origin) for origin in raw_env_origins if origin]
allow_origins = env_origins or default_cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _client_identifier(request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return f"ip:{forwarded.split(',', 1)[0].strip()}"
    if request.client and request.client.host:
        return f"ip:{request.client.host}"
    return "ip:unknown"


def _user_or_ip_identifier(request) -> str:
    token = request.cookies.get(settings.AUTH_ACCESS_COOKIE_NAME)
    authorization = request.headers.get("authorization")
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
    if token:
        try:
            payload = verify_token(token)
            subject = payload.get("sub")
            if subject:
                return f"user:{subject}"
        except Exception:
            pass
    return _client_identifier(request)


def _rate_limit_policy(path: str, method: str) -> Optional[tuple[str, int, str, bool]]:
    if not path.startswith(settings.API_V1_STR):
        return None

    if path in {
        f"{settings.API_V1_STR}/auth/login",
        f"{settings.API_V1_STR}/auth/register",
        f"{settings.API_V1_STR}/auth/refresh",
    }:
        return ("auth", settings.RATE_LIMIT_AUTH_PER_MINUTE, "ip", True)

    if path.startswith(f"{settings.API_V1_STR}/ai") or path.startswith(
        f"{settings.API_V1_STR}/recommendations"
    ) or path.startswith(f"{settings.API_V1_STR}/opportunities"):
        return ("ai", settings.RATE_LIMIT_AI_PER_MINUTE, "user", False)

    if method == "POST" and path.startswith(f"{settings.API_V1_STR}/messages"):
        return ("messages", settings.RATE_LIMIT_MESSAGES_PER_MINUTE, "user", False)

    return ("api", settings.RATE_LIMIT_API_PER_MINUTE, "user", False)


@app.middleware("http")
async def redis_rate_limit_guard(request, call_next):
    policy = _rate_limit_policy(request.url.path, request.method)
    if policy:
        bucket, limit, identifier_kind, fail_closed = policy
        identifier = _client_identifier(request) if identifier_kind == "ip" else _user_or_ip_identifier(request)
        try:
            await check_rate_limit(bucket, identifier, limit, fail_closed=fail_closed)
        except RateLimitExceeded as exc:
            return JSONResponse(
                {"detail": "Rate limit exceeded"},
                status_code=429,
                headers={"Retry-After": str(exc.retry_after)},
            )
        except RateLimitUnavailable:
            return JSONResponse({"detail": "Rate limiter unavailable"}, status_code=503)

    return await call_next(request)


@app.middleware("http")
async def csrf_origin_guard(request, call_next):
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        if origin and not is_allowed_origin(origin, request.headers, request.url.scheme):
            return JSONResponse({"detail": "Invalid request origin"}, status_code=403)
    return await call_next(request)


app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(ws.router)


@app.get("/api/health")
async def health_check():
    """Health check endpoint to verify the API is running."""
    return {
        "status": "ok",
        "service": "alumni-social-network-api",
        "version": "1.0.0"
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Welcome to Alumni Social Network API"}
