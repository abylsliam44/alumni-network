import os
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from app.models.base import Base
from app.core.config import settings

# Get DB URL from env, default to sync for safety but we need async for asyncpg
# We will transform the default postgresql:// to postgresql+asyncpg://
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://alumni_user:alumni_password@postgres:5432/alumni_db")

if "postgresql+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

# Only log SQL queries in debug mode
DEBUG = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")
engine = create_async_engine(
    DATABASE_URL,
    echo=DEBUG,
    pool_pre_ping=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_recycle=settings.DB_POOL_RECYCLE,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


# Celery tasks call asyncio.run() for each job, which creates a new event loop
# and closes it when done. A shared pool would leave asyncpg connections
# attached to the closed loop, causing "Future attached to a different loop".
# NullPool opens a fresh connection per session and discards it immediately —
# nothing survives across asyncio.run() boundaries.
_task_engine = create_async_engine(DATABASE_URL, poolclass=NullPool, echo=DEBUG)
TaskSessionLocal = async_sessionmaker(
    bind=_task_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)
