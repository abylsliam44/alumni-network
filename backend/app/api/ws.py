from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from jose import JWTError, jwt
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.origins import is_allowed_origin
from app.models.message import Conversation
from app.models.user import User
from app.schemas.auth import TokenPayload
from app.schemas.message import MessageRead
from app.services import messaging as messaging_service
from app.services import connection as connection_service

router = APIRouter()


class ConnectionManager:
    """
    In-memory connection manager keyed by user_id.
    Tracks active WebSocket connections and user presence.
    """

    def __init__(self) -> None:
        self.active: dict[uuid.UUID, set[WebSocket]] = {}
        self.last_seen: dict[uuid.UUID, datetime] = {}

    def is_online(self, user_id: uuid.UUID) -> bool:
        """Check if a user is currently online."""
        return user_id in self.active and len(self.active[user_id]) > 0

    def get_online_users(self) -> Set[uuid.UUID]:
        """Get set of all online user IDs."""
        return {uid for uid, sockets in self.active.items() if sockets}

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket) -> bool:
        """Connect a user. Returns True if this is a new connection (was offline)."""
        await websocket.accept()
        was_offline = not self.is_online(user_id)
        self.active.setdefault(user_id, set()).add(websocket)
        self.last_seen[user_id] = datetime.utcnow()
        return was_offline

    def disconnect(self, user_id: uuid.UUID, websocket: WebSocket) -> bool:
        """Disconnect a user. Returns True if user is now offline."""
        if user_id in self.active:
            self.active[user_id].discard(websocket)
            if not self.active[user_id]:
                self.active.pop(user_id, None)
                self.last_seen[user_id] = datetime.utcnow()
                return True
        return False

    async def send_to_user(self, user_id: uuid.UUID, message: Dict[str, Any]) -> None:
        connections = self.active.get(user_id, set())
        for connection in list(connections):
            try:
                await connection.send_json(message)
            except Exception:
                # Drop dead connection silently
                self.disconnect(user_id, connection)

    async def broadcast(self, user_ids: List[uuid.UUID], message: Dict[str, Any]) -> None:
        for user_id in set(user_ids):
            await self.send_to_user(user_id, message)

    def presence_payload(self, user_id: uuid.UUID) -> Dict[str, Any]:
        last_seen = self.last_seen.get(user_id)
        return {
            "user_id": str(user_id),
            "is_online": self.is_online(user_id),
            "last_seen": last_seen.isoformat() if last_seen else None,
        }

    async def broadcast_presence(self, user_id: uuid.UUID, is_online: bool, to_user_ids: List[uuid.UUID]) -> None:
        """Broadcast presence change to specified users."""
        message = {
            "type": "presence",
            "payload": {
                **self.presence_payload(user_id),
                "is_online": is_online,
                "timestamp": datetime.utcnow().isoformat(),
            },
        }
        await self.broadcast(to_user_ids, message)


manager = ConnectionManager()


async def _extract_token(websocket: WebSocket) -> Optional[str]:
    authorization = websocket.headers.get("Authorization") or websocket.headers.get("authorization")
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1]
    return websocket.cookies.get(settings.AUTH_ACCESS_COOKIE_NAME)


async def _authenticate(websocket: WebSocket) -> User:
    if not is_allowed_origin(websocket.headers.get("origin"), websocket.headers, websocket.url.scheme):
        await websocket.close(code=4403)
        raise WebSocketDisconnect

    token = await _extract_token(websocket)
    if not token:
        await websocket.close(code=4401)
        raise WebSocketDisconnect

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_data = TokenPayload(**payload)
        if token_data.type not in (None, "access") or not token_data.sub:
            raise JWTError("Invalid access token")
    except (JWTError, ValueError):
        await websocket.close(code=4401)
        raise WebSocketDisconnect

    async with AsyncSessionLocal() as db:
        user = await db.scalar(select(User).where(User.id == token_data.sub))
        if not user:
            await websocket.close(code=4403)
            raise WebSocketDisconnect
        return user


async def _conversation_participants(
    conversation_id: uuid.UUID,
) -> list[uuid.UUID]:
    async with AsyncSessionLocal() as db:
        return await messaging_service.participant_ids(db, conversation_id)


async def _validate_membership(conversation_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    async with AsyncSessionLocal() as db:
        return await messaging_service.ensure_participant(db, conversation_id, user_id)


async def _store_message(conversation_id: uuid.UUID, sender_id: uuid.UUID, text: str) -> MessageRead:
    return await _store_message_with_attachment(
        conversation_id=conversation_id,
        sender_id=sender_id,
        text=text,
    )


async def _store_message_with_attachment(
    conversation_id: uuid.UUID,
    sender_id: uuid.UUID,
    text: str,
    attachment_url: Optional[str] = None,
    attachment_name: Optional[str] = None,
    attachment_mime_type: Optional[str] = None,
    attachment_size: Optional[int] = None,
) -> MessageRead:
    async with AsyncSessionLocal() as db:
        exists = await db.scalar(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        if not exists:
            raise ValueError("Conversation not found")
        if not await messaging_service.ensure_participant(db, conversation_id, sender_id):
            raise PermissionError("Not a participant")
        message = await messaging_service.save_message(
            db,
            conversation_id=conversation_id,
            sender_id=sender_id,
            text=text,
            attachment_url=attachment_url,
            attachment_name=attachment_name,
            attachment_mime_type=attachment_mime_type,
            attachment_size=attachment_size,
        )
        return MessageRead.from_orm(message)


@router.websocket("/ws/chat")
async def chat_socket(websocket: WebSocket) -> None:
    """
    [MVP v1] WebSocket entry point for real-time chat events.
    """
    user = await _authenticate(websocket)
    was_offline = await manager.connect(user.id, websocket)

    async with AsyncSessionLocal() as db:
        friend_ids = await connection_service.friend_ids_for_user(db, user.id)

    # Notify friends that user is online
    if was_offline:
        async with AsyncSessionLocal() as db:
            friend_ids = await connection_service.friend_ids_for_user(db, user.id)
            await manager.broadcast_presence(user.id, True, friend_ids)

    snapshots = [manager.presence_payload(fid) for fid in friend_ids]
    online_friends = [item["user_id"] for item in snapshots if item["is_online"]]
    await websocket.send_json({
        "type": "online_users",
        "payload": {
            "user_ids": online_friends,
            "users": snapshots,
        },
    })

    try:
        while True:
            payload = await websocket.receive_json()
            event_type = payload.get("type")
            data = payload.get("payload") or {}

            if event_type == "send_message":
                try:
                    conversation_id = uuid.UUID(data.get("conversation_id"))
                except (TypeError, ValueError):
                    await websocket.send_json({"type": "error", "payload": {"message": "Invalid conversation id"}})
                    continue

                text = (data.get("text") or "").strip()
                attachment_url = data.get("attachment_url")
                attachment_name = data.get("attachment_name")
                attachment_mime_type = data.get("attachment_mime_type")
                attachment_size = data.get("attachment_size")
                if not text and not attachment_url:
                    await websocket.send_json({"type": "error", "payload": {"message": "Message text or attachment is required"}})
                    continue
                try:
                    participants = await _conversation_participants(conversation_id)
                    other_id = next((pid for pid in participants if pid != user.id), None)
                    if other_id:
                        async with AsyncSessionLocal() as db:
                            if not await connection_service.are_friends(db=db, user_a=user.id, user_b=other_id):
                                await websocket.send_json({"type": "error", "payload": {"message": "Messaging allowed only between friends"}})
                                continue
                    message = await _store_message_with_attachment(
                        conversation_id=conversation_id,
                        sender_id=user.id,
                        text=text,
                        attachment_url=attachment_url,
                        attachment_name=attachment_name,
                        attachment_mime_type=attachment_mime_type,
                        attachment_size=attachment_size,
                    )
                except PermissionError:
                    await websocket.send_json({"type": "error", "payload": {"message": "Not a participant"}})
                    continue
                except ValueError as exc:
                    await websocket.send_json({"type": "error", "payload": {"message": str(exc)}})
                    continue

                participants = await _conversation_participants(conversation_id)
                encoded_message = jsonable_encoder(message)
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

            elif event_type in {"typing_start", "typing_stop"}:
                conversation_id = data.get("conversation_id")
                if not conversation_id:
                    continue
                try:
                    conversation_uuid = uuid.UUID(conversation_id)
                except ValueError:
                    continue
                if not await _validate_membership(conversation_uuid, user.id):
                    continue
                participants = await _conversation_participants(conversation_uuid)
                recipients = [pid for pid in participants if pid != user.id]
                await manager.broadcast(
                    recipients,
                    {
                        "type": event_type,
                        "payload": {
                            "conversation_id": conversation_id,
                            "user_id": str(user.id),
                        },
                    },
                )

            elif event_type == "message_read":
                conversation_id = data.get("conversation_id")
                last_read_message_id = data.get("last_read_message_id")
                if not (conversation_id and last_read_message_id):
                    continue
                try:
                    conversation_uuid = uuid.UUID(conversation_id)
                    last_uuid = uuid.UUID(last_read_message_id)
                except ValueError:
                    continue

                async with AsyncSessionLocal() as db:
                    if not await messaging_service.ensure_participant(db, conversation_uuid, user.id):
                        continue
                    other_id = await messaging_service.other_participant_id(db, conversation_uuid, user.id)
                    if other_id and not await connection_service.are_friends(db, user.id, other_id):
                        continue
                    updated, read_at = await messaging_service.mark_messages_read_up_to(
                        db,
                        conversation_id=conversation_uuid,
                        reader_id=user.id,
                        last_read_message_id=last_uuid,
                    )
                if updated:
                    participants = await _conversation_participants(conversation_uuid)
                    recipients = [pid for pid in participants if pid != user.id]
                    await manager.broadcast(
                        recipients,
                        {
                            "type": "message_read",
                            "payload": {
                                "conversation_id": conversation_id,
                                "user_id": str(user.id),
                                "last_read_message_id": last_read_message_id,
                                "read_at": read_at.isoformat(),
                            },
                        },
                    )

            elif event_type == "ping":
                # Keep-alive ping
                await websocket.send_json({"type": "pong"})

            elif event_type == "get_online_users":
                # Get list of online friends
                async with AsyncSessionLocal() as db:
                    friend_ids = await connection_service.friend_ids_for_user(db, user.id)
                    snapshots = [manager.presence_payload(fid) for fid in friend_ids]
                    online_friends = [item["user_id"] for item in snapshots if item["is_online"]]
                    await websocket.send_json({
                        "type": "online_users",
                        "payload": {
                            "user_ids": online_friends,
                            "users": snapshots,
                        },
                    })

            else:
                await websocket.send_json(
                    {"type": "error", "payload": {"message": "Unsupported event type"}}
                )
    except WebSocketDisconnect:
        is_now_offline = manager.disconnect(user.id, websocket)
        
        # Notify friends that user is offline
        if is_now_offline:
            async with AsyncSessionLocal() as db:
                friend_ids = await connection_service.friend_ids_for_user(db, user.id)
                await manager.broadcast_presence(user.id, False, friend_ids)
