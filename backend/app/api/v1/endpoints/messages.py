import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.models.message import Conversation
from app.models.user import User
from app.schemas.message import (
    ConversationMessages,
    ConversationSummary,
    MarkConversationReadRequest,
    StartConversationRequest,
    StartConversationResponse,
)
from app.services import messaging as messaging_service
from app.services import connection as connection_service

router = APIRouter()


async def _ensure_participant(
    db: AsyncSession, conversation_id: uuid.UUID, current_user_id: uuid.UUID
) -> None:
    is_participant = await messaging_service.ensure_participant(
        db, conversation_id, current_user_id
    )
    if not is_participant:
        raise HTTPException(
            status_code=403, detail="Not a participant in this conversation"
        )


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    [MVP v1] List all conversations the current user participates in, sorted by recency.
    """
    return await messaging_service.list_conversations_for_user(db, current_user.id)


@router.get("/conversations/{conversation_id}", response_model=ConversationMessages)
async def get_conversation_messages(
    conversation_id: uuid.UUID,
    limit: int = Query(30, ge=1, le=100),
    before: Optional[uuid.UUID] = Query(
        None, description="Fetch messages created before this message id"
    ),
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationMessages:
    """
    [MVP v1] Return a paginated slice of messages for a conversation the user belongs to.
    """
    conversation = await db.scalar(select(Conversation).where(Conversation.id == conversation_id))
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await _ensure_participant(db, conversation_id, current_user.id)
    other_id = await messaging_service.other_participant_id(db, conversation_id, current_user.id)
    if other_id and not await connection_service.are_friends(db, current_user.id, other_id):
        raise HTTPException(status_code=403, detail="Messaging allowed only between friends")
    messages, has_more = await messaging_service.get_messages_page(
        db, conversation_id, limit=limit, before_id=before
    )
    return ConversationMessages(
        conversation_id=conversation_id,
        messages=messages,
        has_more=has_more,
    )


@router.post(
    "/conversations/start",
    response_model=StartConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def start_conversation(
    payload: StartConversationRequest,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> StartConversationResponse:
    """
    [MVP v1] Get or create a 1:1 conversation with another user. Conversation uniqueness is enforced per pair.
    """
    if payload.user_id == current_user.id:
        raise HTTPException(
            status_code=400, detail="Cannot start a conversation with yourself"
        )

    target_user = await db.scalar(select(User).where(User.id == payload.user_id))
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if not await connection_service.are_friends(db, current_user.id, target_user.id):
        raise HTTPException(status_code=403, detail="Messaging allowed only between friends")

    conversation = await messaging_service.get_or_create_conversation(
        db, current_user.id, payload.user_id
    )
    return await messaging_service.build_conversation_summary(
        db, conversation, current_user.id
    )


@router.post("/conversations/{conversation_id}/read", status_code=status.HTTP_200_OK)
async def mark_conversation_read(
    conversation_id: uuid.UUID,
    payload: MarkConversationReadRequest,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    [MVP v1] Mark all messages up to `last_read_message_id` as read for the current user.
    """
    conversation = await db.scalar(select(Conversation).where(Conversation.id == conversation_id))
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await _ensure_participant(db, conversation_id, current_user.id)
    other_id = await messaging_service.other_participant_id(db, conversation_id, current_user.id)
    if other_id and not await connection_service.are_friends(db, current_user.id, other_id):
        raise HTTPException(status_code=403, detail="Messaging allowed only between friends")
    updated, read_at = await messaging_service.mark_messages_read_up_to(
        db=db,
        conversation_id=conversation_id,
        reader_id=current_user.id,
        last_read_message_id=payload.last_read_message_id,
    )
    return {"updated": updated, "read_at": read_at}


