import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.models.connection import ConnectionStatus
from app.models.user import User
from app.schemas.connection import (
    ConnectionCreate,
    ConnectionRead,
    ConnectionRespond,
    FriendsList,
    FriendRead,
)
from app.services import connection as connection_service
from app.schemas.connection import ConnectionUser

router = APIRouter()


@router.post("/request", response_model=ConnectionRead, status_code=status.HTTP_201_CREATED)
async def request_connection(
    payload: ConnectionCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    if payload.recipient_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot connect with yourself")

    connection = await connection_service.create_request(
        db, requester_id=current_user.id, recipient_id=payload.recipient_id
    )
    return connection


@router.post("/{connection_id}/respond", response_model=ConnectionRead)
async def respond_connection(
    connection_id: uuid.UUID,
    payload: ConnectionRespond,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    if payload.status not in {ConnectionStatus.ACCEPTED, ConnectionStatus.DECLINED}:
        raise HTTPException(status_code=400, detail="Invalid status")
    try:
        connection = await connection_service.respond_request(
            db, connection_id=connection_id, recipient_id=current_user.id, status=payload.status
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="Connection not found")
    except PermissionError:
        raise HTTPException(status_code=403, detail="Not allowed to respond to this request")
    return connection


@router.get("/", response_model=list[ConnectionRead])
async def list_connections(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    return await connection_service.list_connections(db, current_user.id)


@router.get("/friends", response_model=FriendsList)
async def list_friends(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> FriendsList:
    friends = await connection_service.friend_users(db, current_user.id)
    friend_profiles: list[FriendRead] = []
    for friend in friends:
        friend_profiles.append(
            FriendRead(
                user=ConnectionUser(
                    id=friend.id,
                    name=friend.name,
                    photo_url=friend.photo_url,
                    role=friend.role,
                    is_mentor=friend.is_mentor,
                )
            )
        )
    return FriendsList(friends=friend_profiles)
