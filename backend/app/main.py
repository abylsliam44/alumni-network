import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import JSONResponse

from app.api import ws
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.origins import is_allowed_origin

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.ENABLE_OPENAPI else None,
    docs_url="/docs" if settings.ENABLE_OPENAPI else None,
    redoc_url="/redoc" if settings.ENABLE_OPENAPI else None,
    # Handle X-Forwarded-Proto from nginx for correct redirect URLs
    root_path="" if not os.getenv("ROOT_PATH") else os.getenv("ROOT_PATH"),
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
env_origins = [origin for origin in settings.BACKEND_CORS_ORIGINS if origin]
allow_origins = env_origins or default_cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
