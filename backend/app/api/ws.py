from __future__ import annotations

import asyncio
import json
import logging
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
from app.core.rate_limit import RateLimitExceeded, check_rate_limit
from app.core.redis import cache_client, pubsub_client
from app.models.message import Conversation
from app.models.user import User
from app.schemas.auth import TokenPayload
from app.schemas.message import MessageRead
from app.services import messaging as messaging_service
from app.services import connection as connection_service

router = APIRouter()
logger = logging.getLogger(__name__)
INSTANCE_ID = settings.INSTANCE_ID or str(uuid.uuid4())
PUBSUB_CHANNEL = "v1:ws:broadcast"
PRESENCE_TTL_SECONDS = 60


class ConnectionManager:
    """
    In-memory connection manager keyed by user_id.
    Tracks active WebSocket connections and user presence.
    """

    def __init__(self) -> None:
        self.active: dict[uuid.UUID, set[WebSocket]] = {}
        self.connection_ids: dict[WebSocket, str] = {}
        self.last_seen: dict[uuid.UUID, datetime] = {}
        self._listener_task: Optional[asyncio.Task] = None

    def _presence_key(self, user_id: uuid.UUID) -> str:
        return f"v1:presence:user:{user_id}"

    def _last_seen_key(self, user_id: uuid.UUID) -> str:
        return f"v1:last_seen:user:{user_id}"

    def is_online_local(self, user_id: uuid.UUID) -> bool:
        return user_id in self.active and len(self.active[user_id]) > 0

    async def is_online(self, user_id: uuid.UUID) -> bool:
        try:
            return bool(await cache_client().scard(self._presence_key(user_id)))
        except Exception:
            logger.exception("Redis presence read failed")
            return self.is_online_local(user_id)

    async def get_online_users(self) -> Set[uuid.UUID]:
        """Get set of all online user IDs."""
        return {uid for uid, sockets in self.active.items() if sockets}

    async def start_pubsub(self) -> None:
        if self._listener_task and not self._listener_task.done():
            return
        self._listener_task = asyncio.create_task(self._listen_for_broadcasts())

    async def stop_pubsub(self) -> None:
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
            self._listener_task = None

    async def _listen_for_broadcasts(self) -> None:
        while True:
            pubsub = None
            try:
                pubsub = pubsub_client().pubsub()
                await pubsub.subscribe(PUBSUB_CHANNEL)
                async for message in pubsub.listen():
                    if message.get("type") != "message":
                        continue
                    data = json.loads(message.get("data") or "{}")
                    if data.get("instance_id") == INSTANCE_ID:
                        continue
                    recipients = [uuid.UUID(item) for item in data.get("recipients", [])]
                    payload = data.get("message") or {}
                    await self._deliver_local(recipients, payload)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Redis WebSocket pub/sub listener failed; retrying")
                await asyncio.sleep(2)
            finally:
                if pubsub:
                    try:
                        await pubsub.close()
                    except Exception:
                        pass

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket) -> bool:
        """Connect a user. Returns True if this is a new connection (was offline)."""
        await websocket.accept()
        was_offline = not await self.is_online(user_id)
        self.active.setdefault(user_id, set()).add(websocket)
        connection_id = str(uuid.uuid4())
        self.connection_ids[websocket] = connection_id
        self.last_seen[user_id] = datetime.utcnow()
        try:
            key = self._presence_key(user_id)
            await cache_client().sadd(key, connection_id)
            await cache_client().expire(key, PRESENCE_TTL_SECONDS)
        except Exception:
            logger.exception("Redis presence write failed")
        return was_offline

    async def disconnect(self, user_id: uuid.UUID, websocket: WebSocket) -> bool:
        """Disconnect a user. Returns True if user is now offline."""
        connection_id = self.connection_ids.pop(websocket, None)
        if user_id in self.active:
            self.active[user_id].discard(websocket)
            if not self.active[user_id]:
                self.active.pop(user_id, None)
                self.last_seen[user_id] = datetime.utcnow()
        try:
            key = self._presence_key(user_id)
            if connection_id:
                await cache_client().srem(key, connection_id)
            remaining = await cache_client().scard(key)
            if remaining == 0:
                seen = datetime.utcnow().isoformat()
                await cache_client().set(self._last_seen_key(user_id), seen, ex=86400)
                self.last_seen[user_id] = datetime.utcnow()
                return True
            return False
        except Exception:
            logger.exception("Redis presence disconnect failed")
            return not self.is_online_local(user_id)

    async def refresh_presence(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        connection_id = self.connection_ids.get(websocket)
        if not connection_id:
            return
        try:
            key = self._presence_key(user_id)
            await cache_client().sadd(key, connection_id)
            await cache_client().expire(key, PRESENCE_TTL_SECONDS)
        except Exception:
            logger.exception("Redis presence refresh failed")

    async def send_to_user(self, user_id: uuid.UUID, message: Dict[str, Any]) -> None:
        connections = self.active.get(user_id, set())
        for connection in list(connections):
            try:
                await connection.send_json(message)
            except Exception:
                # Drop dead connection silently
                await self.disconnect(user_id, connection)

    async def _deliver_local(self, user_ids: List[uuid.UUID], message: Dict[str, Any]) -> None:
        for user_id in set(user_ids):
            await self.send_to_user(user_id, message)

    async def broadcast(self, user_ids: List[uuid.UUID], message: Dict[str, Any]) -> None:
        recipients = list(set(user_ids))
        await self._deliver_local(recipients, message)
        try:
            await pubsub_client().publish(
                PUBSUB_CHANNEL,
                json.dumps(
                    {
                        "instance_id": INSTANCE_ID,
                        "recipients": [str(item) for item in recipients],
                        "message": message,
                    },
                    default=str,
                ),
            )
        except Exception:
            logger.exception("Redis WebSocket publish failed")

    async def presence_payload(self, user_id: uuid.UUID) -> Dict[str, Any]:
        try:
            last_seen_value = await cache_client().get(self._last_seen_key(user_id))
        except Exception:
            logger.exception("Redis last_seen read failed")
            last_seen = self.last_seen.get(user_id)
            last_seen_value = last_seen.isoformat() if last_seen else None
        return {
            "user_id": str(user_id),
            "is_online": await self.is_online(user_id),
            "last_seen": last_seen_value,
        }

    async def broadcast_presence(self, user_id: uuid.UUID, is_online: bool, to_user_ids: List[uuid.UUID]) -> None:
        """Broadcast presence change to specified users."""
        message = {
            "type": "presence",
                "payload": {
                **await self.presence_payload(user_id),
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

    snapshots = [await manager.presence_payload(fid) for fid in friend_ids]
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
                    await check_rate_limit(
                        "messages",
                        f"user:{user.id}",
                        settings.RATE_LIMIT_MESSAGES_PER_MINUTE,
                    )
                except RateLimitExceeded as exc:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "payload": {
                                "message": "Rate limit exceeded",
                                "retry_after": exc.retry_after,
                            },
                        }
                    )
                    continue
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
                await manager.refresh_presence(user.id, websocket)
                await websocket.send_json({"type": "pong"})

            elif event_type == "get_online_users":
                # Get list of online friends
                async with AsyncSessionLocal() as db:
                    friend_ids = await connection_service.friend_ids_for_user(db, user.id)
                    snapshots = [await manager.presence_payload(fid) for fid in friend_ids]
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
        is_now_offline = await manager.disconnect(user.id, websocket)
        
        # Notify friends that user is offline
        if is_now_offline:
            async with AsyncSessionLocal() as db:
                friend_ids = await connection_service.friend_ids_for_user(db, user.id)
                await manager.broadcast_presence(user.id, False, friend_ids)
