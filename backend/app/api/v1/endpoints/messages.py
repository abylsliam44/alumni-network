from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.models.message import Conversation, Message
from app.models.user import User
from app.schemas.message import ConversationRead, MessageCreate, MessageRead, ConversationMessages

router = APIRouter()


def _conversation_filter(user_id):
    return or_(Conversation.participant1_id == user_id, Conversation.participant2_id == user_id)


@router.get("/conversations", response_model=list[ConversationRead])
async def list_conversations(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(select(Conversation).where(_conversation_filter(current_user.id)))
    conversations = result.scalars().all()
    payload: list[ConversationRead] = []
    for convo in conversations:
        last_msg_res = await db.execute(
            select(Message)
            .where(Message.conversation_id == convo.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        last_msg = last_msg_res.scalars().first()
        unread_result = await db.execute(
            select(func.count()).select_from(Message).where(
                Message.conversation_id == convo.id,
                Message.recipient_id == current_user.id,
                Message.is_read.is_(False),
            )
        )
        unread = unread_result.scalar_one()
        payload.append(
            ConversationRead(
                id=convo.id,
                participant1_id=convo.participant1_id,
                participant2_id=convo.participant2_id,
                last_message=last_msg.content if last_msg else None,
                last_message_at=last_msg.created_at if last_msg else None,
                unread_count=unread,
            )
        )
    return payload


@router.get("/conversations/{conversation_id}", response_model=ConversationMessages)
async def get_conversation_messages(
    conversation_id: str,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    convo_res = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    convo = convo_res.scalars().first()
    if not convo or (convo.participant1_id not in [current_user.id] and convo.participant2_id not in [current_user.id]):
        raise HTTPException(status_code=404, detail="Conversation not found")
    msg_res = await db.execute(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at.asc())
    )
    messages = msg_res.scalars().all()
    return ConversationMessages(
        conversation_id=convo.id,
        messages=messages,
    )


@router.post("/messages", response_model=MessageRead, status_code=status.HTTP_201_CREATED)
async def send_message(
    message_in: MessageCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    if message_in.recipient_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    convo_id = message_in.conversation_id
    conversation = None

    if convo_id:
        convo_res = await db.execute(select(Conversation).where(Conversation.id == convo_id))
        conversation = convo_res.scalars().first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        # check if conversation exists between two users
        existing_convo = await db.execute(
            select(Conversation).where(
                or_(
                    (Conversation.participant1_id == current_user.id) & (Conversation.participant2_id == message_in.recipient_id),
                    (Conversation.participant1_id == message_in.recipient_id) & (Conversation.participant2_id == current_user.id),
                )
            )
        )
        conversation = existing_convo.scalars().first()
        if not conversation:
            conversation = Conversation(participant1_id=current_user.id, participant2_id=message_in.recipient_id)
            db.add(conversation)
            await db.flush()

    msg = Message(
        conversation_id=conversation.id if conversation else None,
        sender_id=current_user.id,
        recipient_id=message_in.recipient_id,
        content=message_in.content,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


@router.post("/conversations/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_conversation_read(
    conversation_id: str,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    convo_res = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conversation = convo_res.scalars().first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await db.execute(
        Message.__table__.update()
        .where(Message.conversation_id == conversation_id, Message.recipient_id == current_user.id)
        .values(is_read=True)
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


