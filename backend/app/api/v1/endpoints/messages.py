import uuid
import logging
from pathlib import Path
from typing import Any, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.api.ws import manager
from app.core.cache import get_json, make_cache_key, set_json
from app.core.config import settings
from app.core.database import get_db
from app.models.message import Conversation, Message
from app.models.user import User
from app.schemas.message import (
    ConversationMessages,
    ConversationSummary,
    MarkConversationReadRequest,
    MessageCreate,
    MessageAttachmentUploadResponse,
    MessageRead, 
    StartConversationRequest,
    StartConversationResponse,
)
from app.core import storage
from app.services import messaging as messaging_service
from app.services import connection as connection_service
from app.services import notification as notification_service

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024
ALLOWED_ATTACHMENT_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/ogg",
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
}


def _sanitize_attachment_name(file_name: str) -> str:
    cleaned_name = Path(file_name or "attachment").name
    return cleaned_name.replace("/", "_").replace("\\", "_")


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


async def _get_current_active_user_for_attachment(
    header_user: Optional[User],
) -> User:
    if header_user:
        return header_user
    raise HTTPException(status_code=401, detail="Not authenticated")


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    [MVP v1] List all conversations the current user participates in, sorted by recency.
    """
    cache_key = make_cache_key("conversations", user_id=current_user.id)
    cached = await get_json(cache_key)
    if cached is not None:
        return [ConversationSummary.model_validate(item) for item in cached]

    response = await messaging_service.list_conversations_for_user(db, current_user.id)
    await set_json(
        cache_key,
        [item.model_dump(mode="json") for item in response],
        settings.CACHE_CONVERSATIONS_TTL_SECONDS,
    )
    return response


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
    cache_key = make_cache_key(
        "messages",
        conversation_id=conversation_id,
        user_id=current_user.id,
        limit=limit,
        before=before,
    )
    cached = await get_json(cache_key)
    if cached is not None:
        return ConversationMessages.model_validate(cached)

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
    response = ConversationMessages(
        conversation_id=conversation_id,
        messages=messages,
        has_more=has_more,
    )
    await set_json(cache_key, response.model_dump(mode="json"), settings.CACHE_MESSAGES_TTL_SECONDS)
    return response
   

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


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageRead,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    conversation_id: uuid.UUID,
    payload: MessageCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> MessageRead:
    conversation = await db.scalar(select(Conversation).where(Conversation.id == conversation_id))
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await _ensure_participant(db, conversation_id, current_user.id)
    other_id = await messaging_service.other_participant_id(db, conversation_id, current_user.id)
    if other_id and not await connection_service.are_friends(db, current_user.id, other_id):
        raise HTTPException(status_code=403, detail="Messaging allowed only between friends")

    text = (payload.text or "").strip()
    if not text and not payload.attachment_url:
        raise HTTPException(status_code=400, detail="Message text or attachment is required")

    message = await messaging_service.save_message(
        db,
        conversation_id=conversation_id,
        sender_id=current_user.id,
        text=text,
        attachment_url=payload.attachment_url,
        attachment_name=payload.attachment_name,
        attachment_mime_type=payload.attachment_mime_type,
        attachment_size=payload.attachment_size,
    )
    message_read = MessageRead.from_orm(message)

    participants = await messaging_service.participant_ids(db, conversation_id)

    for participant_id in participants:
        if participant_id == current_user.id:
            continue
        try:
            await notification_service.create_new_message_notification(
                db=db,
                recipient_id=participant_id,
                sender=current_user,
                conversation_id=conversation_id,
                message_preview=text or payload.attachment_name,
            )
        except Exception:
            logger.exception(
                "Failed to create new message notification for conversation %s",
                conversation_id,
            )

    encoded_message = jsonable_encoder(message_read)
    await manager.broadcast(
        participants,
        {
            "type": "new_message",
            "payload": {
                "conversation_id": str(conversation_id),
                "message": encoded_message,
            },
        },
    )

    return message_read


@router.post(
    "/attachments/presigned-url",
    response_model=MessageAttachmentUploadResponse,
    status_code=status.HTTP_200_OK,
)
async def get_attachment_upload_url(
    request: Request,
    filename: str,
    filetype: str,
    filesize: int = Query(..., ge=1),
    current_user: User = Depends(deps.get_current_active_user),
) -> MessageAttachmentUploadResponse:
    del current_user

    if filesize > MAX_ATTACHMENT_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Attachment exceeds {MAX_ATTACHMENT_SIZE // (1024 * 1024)}MB limit",
        )

    normalized_type = (filetype or "").lower()
    if normalized_type not in ALLOWED_ATTACHMENT_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported attachment type")

    upload = storage.generate_presigned_url(
        file_name=_sanitize_attachment_name(filename),
        file_type=normalized_type,
        prefix="messages",
        public_endpoint=storage.infer_public_storage_endpoint(request),
    )
    return MessageAttachmentUploadResponse(**upload)


@router.post(
    "/attachments/upload",
    response_model=MessageAttachmentUploadResponse,
    status_code=status.HTTP_200_OK,
)
async def upload_attachment(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user),
) -> MessageAttachmentUploadResponse:
    del current_user

    normalized_type = (file.content_type or "").lower()
    if normalized_type not in ALLOWED_ATTACHMENT_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported attachment type")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Attachment is empty")

    if len(content) > MAX_ATTACHMENT_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Attachment exceeds {MAX_ATTACHMENT_SIZE // (1024 * 1024)}MB limit",
        )

    upload = storage.upload_bytes(
        content=content,
        file_name=_sanitize_attachment_name(file.filename),
        file_type=normalized_type,
        prefix="messages",
        public_endpoint=storage.infer_public_storage_endpoint(request),
    )
    return MessageAttachmentUploadResponse(
        upload_url="",
        file_url=upload["file_url"],
        object_name=upload["object_name"],
    )


@router.get("/attachments/{message_id}/download", status_code=status.HTTP_200_OK)
async def download_attachment(
    message_id: uuid.UUID,
    download: bool = Query(False),
    header_user: Optional[User] = Depends(deps.get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    current_user = await _get_current_active_user_for_attachment(header_user)

    message = await db.scalar(select(Message).where(Message.id == message_id))
    if not message or not message.attachment_url:
        raise HTTPException(status_code=404, detail="Attachment not found")

    await _ensure_participant(db, message.conversation_id, current_user.id)
    other_id = await messaging_service.other_participant_id(db, message.conversation_id, current_user.id)
    if other_id and not await connection_service.are_friends(db, current_user.id, other_id):
        raise HTTPException(status_code=403, detail="Messaging allowed only between friends")

    stored = storage.get_object_stream(message.attachment_url)
    disposition_type = "attachment" if download else "inline"
    filename = _sanitize_attachment_name(message.attachment_name or "attachment")
    headers = {
        "Content-Disposition": f"{disposition_type}; filename*=UTF-8''{quote(filename)}",
    }
    if stored.get("content_length") is not None:
        headers["Content-Length"] = str(stored["content_length"])

    body = stored["body"]

    def iter_file():
        try:
            while True:
                chunk = body.read(1024 * 1024)
                if not chunk:
                    break
                yield chunk
        finally:
            body.close()

    return StreamingResponse(
        iter_file(),
        media_type=stored["content_type"],
        headers=headers,
    )
