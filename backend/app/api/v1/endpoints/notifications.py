"""
Notification API endpoints for MVP v1

Provides endpoints to:
- List user notifications
- Get unread count
- Mark notifications as read
"""

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.cache import get_json, make_cache_key, set_json
from app.core.database import get_db
from app.models.user import User
from app.schemas.notification import NotificationList, NotificationRead, NotificationMarkRead
from app.services import notification as notification_service

router = APIRouter()


@router.get("/", response_model=NotificationList)
async def list_notifications(
    limit: int = Query(50, le=100),
    unread_only: bool = Query(False),
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get notifications for the current user."""
    cache_key = make_cache_key(
        "notifications",
        "list",
        user_id=current_user.id,
        limit=limit,
        unread_only=unread_only,
    )
    cached = await get_json(cache_key)
    if cached is not None:
        return NotificationList.model_validate(cached)

    notifications = await notification_service.get_user_notifications(
        db, user_id=current_user.id, limit=limit, unread_only=unread_only
    )
    unread_count = await notification_service.get_unread_count(db, current_user.id)
    
    response = NotificationList(
        notifications=[NotificationRead.model_validate(n) for n in notifications],
        unread_count=unread_count,
    )
    await set_json(cache_key, response.model_dump(mode="json"), 20)
    return response


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get count of unread notifications."""
    cache_key = make_cache_key("notifications", "unread-count", user_id=current_user.id)
    cached = await get_json(cache_key)
    if cached is not None:
        return cached

    count = await notification_service.get_unread_count(db, current_user.id)
    response = {"unread_count": count}
    await set_json(cache_key, response, 10)
    return response


@router.post("/mark-read")
async def mark_notifications_read(
    payload: NotificationMarkRead,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Mark specific notifications as read."""
    count = await notification_service.mark_as_read(
        db, user_id=current_user.id, notification_ids=payload.notification_ids
    )
    return {"marked_count": count}


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Mark all notifications as read."""
    count = await notification_service.mark_all_as_read(db, user_id=current_user.id)
    return {"marked_count": count}
