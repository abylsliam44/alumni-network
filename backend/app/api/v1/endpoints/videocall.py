"""
API endpoints for chat video call invitations.
"""

import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from jose import jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.api.ws import manager
from app.core.config import settings
from app.core.database import get_db
from app.models.message import Conversation
from app.models.user import User
from app.schemas.message import MessageRead
from app.services import messaging as messaging_service

logger = logging.getLogger(__name__)

router = APIRouter()


class CreateRoomRequest(BaseModel):
    conversation_id: uuid.UUID


class CreateRoomResponse(BaseModel):
    room_name: str


class VideoCallConfigResponse(BaseModel):
    domain: str
    room_name: str
    external_api_url: str
    jwt: Optional[str] = None


def generate_room_name(conversation_id: uuid.UUID) -> str:
    return f"platform-meeting-{conversation_id}"


def normalize_room_name(value: str) -> str:
    raw = str(value or "").strip()
    sanitized = re.sub(r"[^a-zA-Z0-9_-]", "-", raw)
    sanitized = re.sub(r"-+", "-", sanitized).strip("-")
    return sanitized[:128] if len(sanitized) >= 3 else ""


def _jitsi_domain() -> str:
    raw_domain = str(settings.JITSI_DOMAIN or "meet.jit.si").strip()
    parsed = urlparse(raw_domain if "://" in raw_domain else f"https://{raw_domain}")
    return parsed.netloc or parsed.path.split("/", 1)[0] or "meet.jit.si"


def _is_jaas_domain(domain: str) -> bool:
    return domain == "8x8.vc" or domain.endswith(".8x8.vc")


def _external_api_url(domain: str) -> str:
    if settings.JITSI_EXTERNAL_API_URL:
        return settings.JITSI_EXTERNAL_API_URL
    if _is_jaas_domain(domain) and settings.JITSI_APP_ID:
        return f"https://{domain}/{settings.JITSI_APP_ID}/external_api.js"
    return f"https://{domain}/external_api.js"


def _conference_room_name(domain: str, room_name: str) -> str:
    if _is_jaas_domain(domain) and settings.JITSI_APP_ID:
        return f"{settings.JITSI_APP_ID}/{room_name}"
    return room_name


def _jitsi_signing_key() -> Optional[str]:
    if settings.JITSI_JWT_SIGNING_KEY:
        return settings.JITSI_JWT_SIGNING_KEY.replace("\\n", "\n")

    if settings.JITSI_JWT_SIGNING_KEY_FILE:
        key_path = Path(settings.JITSI_JWT_SIGNING_KEY_FILE)
        if key_path.exists():
            return key_path.read_text(encoding="utf-8")
        raise HTTPException(status_code=500, detail="Jitsi signing key file not found")

    return None


def _jwt_issuer(domain: str) -> str:
    if settings.JITSI_JWT_ISSUER:
        return settings.JITSI_JWT_ISSUER
    if _is_jaas_domain(domain):
        return "chat"
    return settings.JITSI_APP_ID or "jitsi"


def _jwt_subject(domain: str) -> str:
    if settings.JITSI_JWT_SUBJECT:
        return settings.JITSI_JWT_SUBJECT
    return settings.JITSI_APP_ID or domain


def _jwt_algorithm(domain: str) -> str:
    if settings.JITSI_JWT_ALGORITHM:
        return settings.JITSI_JWT_ALGORITHM
    return "RS256" if _is_jaas_domain(domain) else "HS256"


def _jwt_room_claim(room_name: str) -> str:
    if settings.JITSI_JWT_ROOM_CLAIM:
        return settings.JITSI_JWT_ROOM_CLAIM.format(room=room_name)
    return room_name


def _create_jitsi_jwt(current_user: User, domain: str, room_name: str) -> Optional[str]:
    signing_key = _jitsi_signing_key()
    if not signing_key:
        return None

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.JITSI_JWT_EXPIRE_MINUTES)
    user_name = current_user.name or current_user.email or "Guest"

    payload = {
        "aud": settings.JITSI_JWT_AUDIENCE,
        "iss": _jwt_issuer(domain),
        "sub": _jwt_subject(domain),
        "room": _jwt_room_claim(room_name),
        "nbf": int((now - timedelta(seconds=10)).timestamp()),
        "exp": int(expires_at.timestamp()),
        "context": {
            "user": {
                "id": str(current_user.id),
                "name": user_name,
                "email": current_user.email or "",
                "moderator": "true",
            },
            "features": {
                "livestreaming": "false",
                "recording": "false",
                "transcription": "false",
                "outbound-call": "false",
            },
            "room": {
                "regex": False,
            },
        },
    }
    headers = {"kid": settings.JITSI_JWT_KEY_ID} if settings.JITSI_JWT_KEY_ID else None
    return jwt.encode(payload, signing_key, algorithm=_jwt_algorithm(domain), headers=headers)


@router.get("/config", response_model=VideoCallConfigResponse)
async def get_video_call_config(
    room_name: str,
    current_user: User = Depends(deps.get_current_active_user),
):
    normalized_room_name = normalize_room_name(room_name)
    if not normalized_room_name:
        raise HTTPException(status_code=400, detail="Invalid room name")

    domain = _jitsi_domain()
    if _is_jaas_domain(domain) and not settings.JITSI_APP_ID:
        raise HTTPException(status_code=500, detail="Jitsi JaaS app id is not configured")

    token = _create_jitsi_jwt(current_user, domain, normalized_room_name)
    if _is_jaas_domain(domain) and not token:
        raise HTTPException(status_code=500, detail="Jitsi JaaS JWT signing is not configured")

    return VideoCallConfigResponse(
        domain=domain,
        room_name=_conference_room_name(domain, normalized_room_name),
        external_api_url=_external_api_url(domain),
        jwt=token,
    )


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
    if other_id and not await messaging_service.can_message_user(db, current_user.id, other_id):
        raise HTTPException(status_code=403, detail="Video calls allowed only between friends or mentorship participants")

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
