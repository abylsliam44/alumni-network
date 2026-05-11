"""
Notification service for MVP v1

Handles creation and management of user notifications.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.cache import invalidate_namespaces
from app.models.notification import Notification, NotificationType
from app.models.user import User


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    notification_type: NotificationType,
    title: str,
    message: str,
    actor_id: Optional[uuid.UUID] = None,
    reference_id: Optional[uuid.UUID] = None,
) -> Notification:
    """Create a new notification for a user."""
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        actor_id=actor_id,
        reference_id=reference_id,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    await invalidate_namespaces("notifications")
    return notification


async def create_friend_request_notification(
    db: AsyncSession,
    recipient_id: uuid.UUID,
    requester: User,
    connection_id: uuid.UUID,
) -> Notification:
    """Create a notification for a new friend request."""
    return await create_notification(
        db=db,
        user_id=recipient_id,
        notification_type=NotificationType.FRIEND_REQUEST,
        title="New Friend Request",
        message=f"{requester.name} sent you a friend request",
        actor_id=requester.id,
        reference_id=connection_id,
    )


async def create_friend_accepted_notification(
    db: AsyncSession,
    requester_id: uuid.UUID,
    accepter: User,
    connection_id: uuid.UUID,
) -> Notification:
    """Create a notification when a friend request is accepted."""
    return await create_notification(
        db=db,
        user_id=requester_id,
        notification_type=NotificationType.FRIEND_ACCEPTED,
        title="Friend Request Accepted",
        message=f"{accepter.name} accepted your friend request",
        actor_id=accepter.id,
        reference_id=connection_id,
    )


async def create_mentorship_request_notification(
    db: AsyncSession,
    mentor_id: uuid.UUID,
    requester: User,
    request_id: uuid.UUID,
) -> Notification:
    """Create a notification when a mentorship request is received."""
    return await create_notification(
        db=db,
        user_id=mentor_id,
        notification_type=NotificationType.MENTORSHIP_REQUEST,
        title="New Mentorship Request",
        message=f"{requester.name} sent you a mentorship request",
        actor_id=requester.id,
        reference_id=request_id,
    )


async def create_mentor_feedback_notification(
    db: AsyncSession,
    mentee_id: uuid.UUID,
    mentor: User,
    feedback_id: uuid.UUID,
    rating: int,
) -> Notification:
    """Create a notification when a mentor leaves feedback for their mentee."""
    stars = "★" * rating + "☆" * (5 - rating)
    return await create_notification(
        db=db,
        user_id=mentee_id,
        notification_type=NotificationType.MENTOR_FEEDBACK,
        title="New Feedback from Your Mentor",
        message=f"{mentor.name} rated you {stars} ({rating}/5)",
        actor_id=mentor.id,
        reference_id=feedback_id,
    )


async def create_mentorship_accepted_notification(
    db: AsyncSession,
    mentee_id: uuid.UUID,
    mentor: User,
    relationship_id: uuid.UUID,
) -> Notification:
    """Create a notification when a mentorship request is accepted."""
    return await create_notification(
        db=db,
        user_id=mentee_id,
        notification_type=NotificationType.MENTORSHIP_ACCEPTED,
        title="Mentorship Request Accepted",
        message=f"{mentor.name} accepted your mentorship request",
        actor_id=mentor.id,
        reference_id=relationship_id,
    )


async def create_new_message_notification(
    db: AsyncSession,
    recipient_id: uuid.UUID,
    sender: User,
    conversation_id: uuid.UUID,
    message_preview: Optional[str] = None,
) -> Notification:
    """Create a notification for a newly received direct message."""
    preview = (message_preview or "").strip()
    if preview:
        preview = preview[:120]
        if len(message_preview or "") > 120:
            preview += "..."
        body = f"{sender.name}: {preview}"
    else:
        body = f"{sender.name} sent you a message"

    return await create_notification(
        db=db,
        user_id=recipient_id,
        notification_type=NotificationType.NEW_MESSAGE,
        title="New Message",
        message=body,
        actor_id=sender.id,
        reference_id=conversation_id,
    )


async def get_user_notifications(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 50,
    unread_only: bool = False,
) -> List[Notification]:
    """Get notifications for a user."""
    query = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .options(selectinload(Notification.actor))
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    
    if unread_only:
        query = query.where(Notification.is_read == False)
    
    result = await db.execute(query)
    return result.scalars().all()


async def get_unread_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Get count of unread notifications for a user."""
    result = await db.execute(
        select(func.count(Notification.id))
        .where(Notification.user_id == user_id, Notification.is_read == False)
    )
    return result.scalar() or 0


async def mark_as_read(
    db: AsyncSession,
    user_id: uuid.UUID,
    notification_ids: List[uuid.UUID],
) -> int:
    """Mark notifications as read. Returns count of updated notifications."""
    result = await db.execute(
        update(Notification)
        .where(
            Notification.id.in_(notification_ids),
            Notification.user_id == user_id,
        )
        .values(is_read=True, read_at=datetime.utcnow())
    )
    await db.commit()
    await invalidate_namespaces("notifications")
    return result.rowcount


async def mark_all_as_read(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Mark all notifications as read for a user."""
    result = await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read == False)
        .values(is_read=True, read_at=datetime.utcnow())
    )
    await db.commit()
    await invalidate_namespaces("notifications")
    return result.rowcount
