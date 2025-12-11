from __future__ import annotations

import uuid
from typing import List, Optional

from sqlalchemy import or_, select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.connection import Connection, ConnectionStatus
from app.models.user import User
from app.services import notification as notification_service


async def are_friends(db: AsyncSession, user_a: uuid.UUID, user_b: uuid.UUID) -> bool:
    return bool(
        await db.scalar(
            select(Connection.id).where(
                Connection.status == ConnectionStatus.ACCEPTED,
                or_(
                    and_(Connection.requester_id == user_a, Connection.recipient_id == user_b),
                    and_(Connection.requester_id == user_b, Connection.recipient_id == user_a),
                ),
            )
        )
    )


async def get_connection_between(
    db: AsyncSession, user_a: uuid.UUID, user_b: uuid.UUID
) -> Optional[Connection]:
    return await db.scalar(
        select(Connection)
        .where(
            or_(
                and_(Connection.requester_id == user_a, Connection.recipient_id == user_b),
                and_(Connection.requester_id == user_b, Connection.recipient_id == user_a),
            )
        )
        .options(selectinload(Connection.requester), selectinload(Connection.recipient))
    )


async def create_request(
    db: AsyncSession, requester_id: uuid.UUID, recipient_id: uuid.UUID
) -> Connection:
    existing = await get_connection_between(db, requester_id, recipient_id)
    if existing:
        return existing

    # Get requester info for notification
    requester = await db.scalar(select(User).where(User.id == requester_id))

    connection = Connection(
        requester_id=requester_id,
        recipient_id=recipient_id,
        status=ConnectionStatus.PENDING,
    )
    db.add(connection)
    await db.commit()
    await db.refresh(connection)
    
    # Create notification for the recipient
    if requester:
        await notification_service.create_friend_request_notification(
            db=db,
            recipient_id=recipient_id,
            requester=requester,
            connection_id=connection.id,
        )
    
    return connection


async def respond_request(
    db: AsyncSession, connection_id: uuid.UUID, recipient_id: uuid.UUID, status: ConnectionStatus
) -> Connection:
    connection = await db.scalar(
        select(Connection)
        .where(Connection.id == connection_id)
        .options(selectinload(Connection.requester), selectinload(Connection.recipient))
    )
    if not connection:
        raise ValueError("Connection not found")
    if connection.recipient_id != recipient_id:
        raise PermissionError("Only recipient can respond")

    connection.status = status
    await db.commit()
    await db.refresh(connection)
    
    # Create notification for the requester if accepted
    if status == ConnectionStatus.ACCEPTED and connection.recipient:
        await notification_service.create_friend_accepted_notification(
            db=db,
            requester_id=connection.requester_id,
            accepter=connection.recipient,
            connection_id=connection.id,
        )
    
    return connection


async def list_connections(db: AsyncSession, user_id: uuid.UUID) -> list[Connection]:
    result = await db.execute(
        select(Connection)
        .where(or_(Connection.requester_id == user_id, Connection.recipient_id == user_id))
        .options(selectinload(Connection.requester), selectinload(Connection.recipient))
        .order_by(Connection.created_at.desc())
    )
    return result.scalars().all()


async def friend_ids_for_user(db: AsyncSession, user_id: uuid.UUID) -> List[uuid.UUID]:
    result = await db.execute(
        select(Connection).where(
            Connection.status == ConnectionStatus.ACCEPTED,
            or_(Connection.requester_id == user_id, Connection.recipient_id == user_id),
        )
    )
    connections = result.scalars().all()
    ids: set[uuid.UUID] = set()
    for conn in connections:
        other = conn.recipient_id if conn.requester_id == user_id else conn.requester_id
        ids.add(other)
    return list(ids)


async def friend_users(db: AsyncSession, user_id: uuid.UUID) -> List[User]:
    ids = await friend_ids_for_user(db, user_id)
    if not ids:
        return []
    result = await db.execute(select(User).where(User.id.in_(ids)))
    return result.scalars().all()
