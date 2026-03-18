"""
[MVP v1] API endpoints для видеозвонков с LiveKit.
"""

import os
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, status
from fastapi.encoders import jsonable_encoder
from app.api.ws import manager
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.api import deps
from app.core.config import settings
from app.core.database import get_db
from app.models.message import Conversation
from app.models.user import User
from app.services import messaging as messaging_service
from app.services import connection as connection_service
from app.schemas.message import MessageRead

# Lazy import для livekit - будет установлен позже
try:
    from livekit import api as livekit_api
    LIVEKIT_AVAILABLE = True
except ImportError:
    LIVEKIT_AVAILABLE = False

logger = logging.getLogger(__name__)

router = APIRouter()

# Конфигурация LiveKit
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "").strip().rstrip("/")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "").strip()
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "").strip()


def _agent_secret() -> str:
    return (settings.BACKEND_API_SECRET or settings.SECRET_KEY).strip()


class CreateRoomRequest(BaseModel):
    conversation_id: uuid.UUID


class CreateRoomResponse(BaseModel):
    room_name: str
    token: str
    livekit_url: str


class JoinRoomRequest(BaseModel):
    room_name: str


class JoinRoomResponse(BaseModel):
    token: str
    livekit_url: str


class SaveSummaryRequest(BaseModel):
    conversation_id: str
    room_name: str
    transcript: Optional[str] = None
    summary: str
    duration_seconds: int


def generate_room_name(conversation_id: uuid.UUID) -> str:
    """Генерирует уникальное имя комнаты для звонка."""
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    return f"call_{conversation_id}_{timestamp}"


def create_access_token(
    room_name: str,
    participant_identity: str,
    participant_name: str,
    is_agent: bool = False,
) -> str:
    """Создает LiveKit access token для участника."""
    if not LIVEKIT_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="LiveKit not configured. Please install livekit-api package."
        )
    
    if not all([LIVEKIT_API_KEY, LIVEKIT_API_SECRET]):
        raise HTTPException(
            status_code=503,
            detail="LiveKit credentials not configured"
        )
    
    logger.debug(f"Creating token for room: {room_name}, participant: {participant_name}")

    # Права доступа
    grant = livekit_api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=not is_agent,  # Агент не публикует, только слушает
        can_subscribe=True,
        can_publish_data=True,
    )

    token = (
        livekit_api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(participant_identity)
        .with_name(participant_name)
        .with_grants(grant)
        .with_ttl(timedelta(seconds=7200))
    )
    
    return token.to_jwt()


@router.post("/create-room", response_model=CreateRoomResponse)
async def create_room(
    request: CreateRoomRequest,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Создает комнату LiveKit для видеозвонка.
    Возвращает токен для подключения инициатора звонка.
    """
    # Проверяем существование разговора
    conversation = await db.scalar(
        select(Conversation).where(Conversation.id == request.conversation_id)
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Проверяем, что пользователь участник разговора
    if not await messaging_service.ensure_participant(db, request.conversation_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not a participant in this conversation")
    
    # Проверяем, что оба участника друзья
    other_id = await messaging_service.other_participant_id(db, request.conversation_id, current_user.id)
    if other_id and not await connection_service.are_friends(db, current_user.id, other_id):
        raise HTTPException(status_code=403, detail="Video calls allowed only between friends")
    
    # Генерируем имя комнаты
    room_name = generate_room_name(request.conversation_id)
    
    # Создаем токен для инициатора
    token = create_access_token(
        room_name=room_name,
        participant_identity=str(current_user.id),
        participant_name=current_user.name,
    )

    # -------------------------------------------------------------
    # Отправляем уведомление в чат о начале звонка
    # -------------------------------------------------------------
    # Формат сообщения: JOIN_VIDEO_CALL|{room_name}
    # Фронтенд распарсит это и покажет кнопку "Присоединиться"
    system_message_text = f"JOIN_VIDEO_CALL|{room_name}"
    try:
        # Сохраняем сообщение в БД
        message = await messaging_service.save_message(
            db,
            conversation_id=request.conversation_id,
            sender_id=current_user.id,
            text=system_message_text,
            is_system=True,
        )

        # Бродкастим через WebSocket
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
    except Exception as e:
        # Логируем ошибку, но не прерываем создание комнаты
        logger.error(f"Failed to send call notification: {e}")
    
    return CreateRoomResponse(
        room_name=room_name,
        token=token,
        livekit_url=LIVEKIT_URL,
    )


@router.post("/join-room", response_model=JoinRoomResponse)
async def join_room(
    request: JoinRoomRequest,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Присоединяется к существующей комнате LiveKit.
    Токен для вызываемого участника.
    """
    # Извлекаем conversation_id из имени комнаты
    parts = request.room_name.split("_")
    if len(parts) < 3 or parts[0] != "call":
        raise HTTPException(status_code=400, detail="Invalid room name format")
    
    try:
        conversation_id = uuid.UUID(parts[1])
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation ID in room name")
    
    # Проверяем участие в разговоре
    if not await messaging_service.ensure_participant(db, conversation_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not a participant in this conversation")
    
    # Создаем токен
    token = create_access_token(
        room_name=request.room_name,
        participant_identity=str(current_user.id),
        participant_name=current_user.name,
    )
    
    return JoinRoomResponse(
        token=token,
        livekit_url=LIVEKIT_URL,
    )


@router.post("/save-summary", status_code=status.HTTP_200_OK)
async def save_call_summary(
    request: SaveSummaryRequest,
    x_agent_secret: str = Header(None, alias="X-Agent-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """
    Сохраняет саммари звонка как системное сообщение в чате.
    Этот эндпоинт вызывается только AI-агентом.
    """
    # Проверяем секретный ключ агента
    if x_agent_secret != _agent_secret():
        raise HTTPException(status_code=401, detail="Invalid agent secret")
    
    try:
        conversation_id = uuid.UUID(request.conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation ID")
    
    # Проверяем существование разговора
    conversation = await db.scalar(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Форматируем сообщение для чата
    duration_min = request.duration_seconds // 60
    duration_sec = request.duration_seconds % 60
    
    system_message = f"""📹 **Видеозвонок завершён**
⏱️ Длительность: {duration_min} мин {duration_sec} сек

{request.summary}
"""
    
    # Получаем первого участника как отправителя системного сообщения
    participants = await messaging_service.participant_ids(db, conversation_id)
    if not participants:
        raise HTTPException(status_code=400, detail="No participants in conversation")
    
    # Сохраняем как системное сообщение
    await messaging_service.save_message(
        db,
        conversation_id=conversation_id,
        sender_id=participants[0],  # Используем первого участника
        text=system_message,
        is_system=True,
    )
    
    return {"status": "ok", "message": "Summary saved successfully"}


@router.get("/config")
async def get_videocall_config(
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Возвращает конфигурацию видеозвонков для клиента.
    """
    return {
        "enabled": bool(LIVEKIT_URL and LIVEKIT_API_KEY and LIVEKIT_API_SECRET),
        "livekit_url": LIVEKIT_URL if LIVEKIT_URL else None,
    }
