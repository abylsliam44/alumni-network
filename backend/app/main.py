from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from pathlib import Path

from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.v1.router import api_router
from app.api import ws

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
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
allow_origins = settings.BACKEND_CORS_ORIGINS or default_cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
