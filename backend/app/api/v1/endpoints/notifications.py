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
    notifications = await notification_service.get_user_notifications(
        db, user_id=current_user.id, limit=limit, unread_only=unread_only
    )
    unread_count = await notification_service.get_unread_count(db, current_user.id)
    
    return NotificationList(
        notifications=[NotificationRead.model_validate(n) for n in notifications],
        unread_count=unread_count,
    )


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get count of unread notifications."""
    count = await notification_service.get_unread_count(db, current_user.id)
    return {"unread_count": count}


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
