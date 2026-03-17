from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, Tuple

from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.message import Conversation, ConversationParticipant, Message
from app.models.user import User
from app.schemas.message import ConversationSummary, ConversationUser, MessageRead
from app.services import connection as connection_service


async def find_conversation_between_users(
    db: AsyncSession, user_a: uuid.UUID, user_b: uuid.UUID
) -> Optional[Conversation]:
    conversation_ids = (
        select(ConversationParticipant.conversation_id)
        .where(ConversationParticipant.user_id.in_([user_a, user_b]))
        .group_by(ConversationParticipant.conversation_id)
        .having(func.count(func.distinct(ConversationParticipant.user_id)) == 2)
        .subquery()
    )

    return await db.scalar(
        select(Conversation)
        .join(conversation_ids, conversation_ids.c.conversation_id == Conversation.id)
        .options(
            selectinload(Conversation.participants).selectinload(
                ConversationParticipant.user
            )
        )
        .limit(1)
    )


async def create_conversation(
    db: AsyncSession, user_a: uuid.UUID, user_b: uuid.UUID
) -> Conversation:
    conversation = Conversation()
    db.add(conversation)
    await db.flush()

    db.add_all(
        [
            ConversationParticipant(conversation_id=conversation.id, user_id=user_a),
            ConversationParticipant(conversation_id=conversation.id, user_id=user_b),
        ]
    )
    await db.commit()
    await db.refresh(conversation)
    await db.refresh(conversation, attribute_names=["participants"])
    return conversation


async def get_or_create_conversation(
    db: AsyncSession, user_a: uuid.UUID, user_b: uuid.UUID
) -> Conversation:
    existing = await find_conversation_between_users(db, user_a, user_b)
    if existing:
        return existing
    return await create_conversation(db, user_a, user_b)


async def conversation_other_user(
    conversation: Conversation, current_user_id: uuid.UUID
) -> Optional[User]:
    for participant in conversation.participants:
        if participant.user_id != current_user_id:
            return participant.user
    return None


async def latest_message(
    db: AsyncSession, conversation_id: uuid.UUID
) -> Optional[Message]:
    return await db.scalar(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(1)
    )


async def unread_count_for_user(
    db: AsyncSession, conversation_id: uuid.UUID, user_id: uuid.UUID
) -> int:
    return await db.scalar(
        select(func.count())
        .select_from(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.sender_id != user_id,
            Message.is_read.is_(False),
        )
    ) or 0


async def build_conversation_summary(
    db: AsyncSession, conversation: Conversation, current_user_id: uuid.UUID
) -> ConversationSummary:
    other_user = await conversation_other_user(conversation, current_user_id)
    last_message = await latest_message(db, conversation.id)
    unread_count = await unread_count_for_user(
        db, conversation.id, current_user_id
    )

    other_user_payload = (
        ConversationUser(
            id=other_user.id,
            name=other_user.name,
            photo_url=other_user.photo_url,
            role=other_user.role,
            is_mentor=other_user.is_mentor,
        )
        if other_user
        else None
    )

    last_message_payload = (
        MessageRead.from_orm(last_message) if last_message else None
    )

    return ConversationSummary(
        conversation_id=conversation.id,
        other_user=other_user_payload,
        last_message=last_message_payload,
        unread_count=unread_count,
    )


async def list_conversations_for_user(
    db: AsyncSession, user_id: uuid.UUID
) -> list[ConversationSummary]:
    friend_ids = set(await connection_service.friend_ids_for_user(db, user_id))
    result = await db.execute(
        select(Conversation)
        .join(ConversationParticipant)
        .where(ConversationParticipant.user_id == user_id)
        .options(
            selectinload(Conversation.participants).selectinload(
                ConversationParticipant.user
            )
        )
        .order_by(Conversation.created_at.desc())
    )
    conversations = result.scalars().unique().all()
    summaries: list[ConversationSummary] = []
    for conversation in conversations:
        other = await conversation_other_user(conversation, user_id)
        if not other or other.id not in friend_ids:
            continue
        summaries.append(await build_conversation_summary(db, conversation, user_id))
    summaries.sort(
        key=lambda s: s.last_message.created_at if s.last_message else datetime.min,
        reverse=True,
    )
    return summaries


async def get_messages_page(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    limit: int = 30,
    before_id: Optional[uuid.UUID] = None,
) -> Tuple[list[Message], bool]:
    query = select(Message).where(Message.conversation_id == conversation_id)

    if before_id:
        pivot_created_at = await db.scalar(
            select(Message.created_at).where(
                and_(Message.id == before_id, Message.conversation_id == conversation_id)
            )
        )
        if pivot_created_at:
            query = query.where(Message.created_at < pivot_created_at)

    query = query.order_by(Message.created_at.desc()).limit(limit + 1)
    messages = (await db.execute(query)).scalars().all()

    has_more = len(messages) > limit
    messages = messages[:limit]
    messages.reverse()
    return messages, has_more


async def save_message(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    sender_id: uuid.UUID,
    text: str,
    is_system: bool = False,
    attachment_url: Optional[str] = None,
    attachment_name: Optional[str] = None,
    attachment_mime_type: Optional[str] = None,
    attachment_size: Optional[int] = None,
) -> Message:
    message = Message(
        conversation_id=conversation_id,
        sender_id=sender_id,
        text=text,
        is_system=is_system,
        attachment_url=attachment_url,
        attachment_name=attachment_name,
        attachment_mime_type=attachment_mime_type,
        attachment_size=attachment_size,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


async def mark_messages_read_up_to(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    reader_id: uuid.UUID,
    last_read_message_id: uuid.UUID,
) -> tuple[int, datetime]:
    pivot_created_at = await db.scalar(
        select(Message.created_at).where(
            and_(Message.id == last_read_message_id, Message.conversation_id == conversation_id)
        )
    )
    if not pivot_created_at:
        return 0, datetime.utcnow()

    read_at = datetime.utcnow()
    result = await db.execute(
        update(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.sender_id != reader_id,
            Message.created_at <= pivot_created_at,
            Message.is_read.is_(False),
        )
        .values(is_read=True, read_at=read_at)
        .returning(Message.id)
    )
    updated_rows = len(result.fetchall())
    await db.commit()
    return updated_rows, read_at


async def ensure_participant(
    db: AsyncSession, conversation_id: uuid.UUID, user_id: uuid.UUID
) -> bool:
    return bool(
        await db.scalar(
            select(func.count())
            .select_from(ConversationParticipant)
            .where(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == user_id,
            )
        )
    )


async def other_participant_id(
    db: AsyncSession, conversation_id: uuid.UUID, current_user_id: uuid.UUID
) -> Optional[uuid.UUID]:
    result = await db.execute(
        select(ConversationParticipant.user_id).where(
            ConversationParticipant.conversation_id == conversation_id
        )
    )
    for row in result.fetchall():
        uid = row[0]
        if uid != current_user_id:
            return uid
    return None


async def participant_ids(
    db: AsyncSession, conversation_id: uuid.UUID
) -> list[uuid.UUID]:
    result = await db.execute(
        select(ConversationParticipant.user_id).where(
            ConversationParticipant.conversation_id == conversation_id
        )
    )
    return [row[0] for row in result.all()]
