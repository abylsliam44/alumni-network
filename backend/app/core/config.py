from typing import Any, Dict, List, Optional, Union
from pydantic import AnyHttpUrl, EmailStr, validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Alumni Social Network"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    AUTH_ACCESS_COOKIE_NAME: str = "access_token"
    AUTH_REFRESH_COOKIE_NAME: str = "refresh_token"
    AUTH_COOKIE_SECURE: bool = False
    AUTH_COOKIE_SAMESITE: str = "lax"
    AUTH_COOKIE_DOMAIN: Optional[str] = None
    ENABLE_OPENAPI: bool = True
    INSTANCE_ID: Optional[str] = None
    GOOGLE_AI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None

    # Redis / Celery
    REDIS_CACHE_URL: str = "redis://redis-cache:6379/0"
    REDIS_PUBSUB_URL: str = "redis://redis-cache:6379/1"
    REDIS_RATE_LIMIT_URL: str = "redis://redis-cache:6379/2"
    REDIS_CACHE_MAXMEMORY: str = "256mb"
    CELERY_BROKER_URL: str = "redis://redis-celery:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis-celery:6379/1"
    WEB_CONCURRENCY: int = 2

    # Cache TTLs
    CACHE_DEFAULT_TTL_SECONDS: int = 60
    CACHE_DIRECTORY_TTL_SECONDS: int = 45
    CACHE_PROFILE_TTL_SECONDS: int = 120
    CACHE_CONVERSATIONS_TTL_SECONDS: int = 15
    CACHE_MESSAGES_TTL_SECONDS: int = 30
    CACHE_RECOMMENDATIONS_TTL_SECONDS: int = 300
    CACHE_OPPORTUNITIES_TTL_SECONDS: int = 300

    # Rate limits
    RATE_LIMIT_AUTH_PER_MINUTE: int = 10
    RATE_LIMIT_API_PER_MINUTE: int = 180
    RATE_LIMIT_AI_PER_MINUTE: int = 20
    RATE_LIMIT_MESSAGES_PER_MINUTE: int = 60
    
    # Vector search / AI
    QDRANT_URL: str = "http://qdrant:6333"
    QDRANT_API_KEY: Optional[str] = None
    EMBEDDING_MODEL: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    # Storage
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 5 * 1024 * 1024
    
    # MinIO (S3-compatible storage)
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_PUBLIC_ENDPOINT: Optional[str] = None
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "alumni-files"
    MINIO_SECURE: bool = False

    # Resume processing
    RESUME_WORKER_POLL_INTERVAL_SECONDS: float = 3.0
    
    # Email (SMTP)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAIL_FROM: Optional[str] = None
    EMAIL_FROM_NAME: str = "Alumni Network"

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()

