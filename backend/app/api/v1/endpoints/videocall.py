"""
API endpoints for chat video call invitations.
"""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.api.ws import manager
from app.core.database import get_db
from app.models.message import Conversation
from app.models.user import User
from app.schemas.message import MessageRead
from app.services import connection as connection_service
from app.services import messaging as messaging_service

logger = logging.getLogger(__name__)

router = APIRouter()


class CreateRoomRequest(BaseModel):
    conversation_id: uuid.UUID


class CreateRoomResponse(BaseModel):
    room_name: str


def generate_room_name(conversation_id: uuid.UUID) -> str:
    return f"platform-meeting-{conversation_id}"


@router.post("/create-room", response_model=CreateRoomResponse)
async def create_room(
    request: CreateRoomRequest,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    conversation = await db.scalar(
        select(Conversation).where(Conversation.id == request.conversation_id)
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if not await messaging_service.ensure_participant(db, request.conversation_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not a participant in this conversation")

    other_id = await messaging_service.other_participant_id(db, request.conversation_id, current_user.id)
    if other_id and not await connection_service.are_friends(db, current_user.id, other_id):
        raise HTTPException(status_code=403, detail="Video calls allowed only between friends")

    room_name = generate_room_name(request.conversation_id)
    system_message_text = f"JOIN_VIDEO_CALL|{room_name}"

    try:
        message = await messaging_service.save_message(
            db,
            conversation_id=request.conversation_id,
            sender_id=current_user.id,
            text=system_message_text,
            is_system=True,
        )

        participants_ids = await messaging_service.participant_ids(db, request.conversation_id)
        encoded_message = jsonable_encoder(MessageRead.from_orm(message))

        await manager.broadcast(
            participants_ids,
            {
                "type": "new_message",
                "payload": {
                    "conversation_id": str(request.conversation_id),
                    "message": encoded_message,
                },
            },
        )
    except Exception as exc:
        logger.error("Failed to send call notification: %s", exc)

    return CreateRoomResponse(room_name=room_name)
