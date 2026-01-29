import json
import logging
from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api import deps
from app.core.database import get_db
from app.models.job import JobApplication, JobChatMessage
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # Map application_id to list of WebSockets
        self.active_connections: dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, application_id: str):
        await websocket.accept()
        if application_id not in self.active_connections:
            self.active_connections[application_id] = []
        self.active_connections[application_id].append(websocket)

    def disconnect(self, websocket: WebSocket, application_id: str):
        if application_id in self.active_connections:
            if websocket in self.active_connections[application_id]:
                self.active_connections[application_id].remove(websocket)
            if not self.active_connections[application_id]:
                del self.active_connections[application_id]

    async def broadcast(self, message: str, application_id: str):
        if application_id in self.active_connections:
            for connection in self.active_connections[application_id]:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    logger.warning(f"Failed to send to connection: {e}")

manager = ConnectionManager()

@router.websocket("/ws/{application_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    application_id: str,
    token: str, # passed as query param ?token=...
    db: AsyncSession = Depends(get_db),
):
    # Authenticate via token manually since WebSocket doesn't support Depends(oauth2) easily in initial handshake header standardly in all clients
    # or Assume client sends proper protocol.
    # We will use get_current_user logic manually.
    
    user = await deps.get_current_user_optional(db, token)
    if not user:
        await websocket.close(code=1008)
        return

    # Check permission
    # Use a new DB session scope if needed, but Depends(get_db) creates one.
    # Note: `user` was fetched using `db`.
    
    result = await db.execute(select(JobApplication).options(selectinload(JobApplication.job)).where(JobApplication.id == application_id))
    application = result.scalars().first()
    
    if not application:
        await websocket.close(code=1008)
        return

    # Check if user is applicant OR job poster (OR admin)
    job = application.job
    is_authorized = (
        user.id == application.applicant_id or 
        user.id == job.created_by or 
        user.is_admin
    )
    
    if not is_authorized:
        await websocket.close(code=1008)
        return
        
    await manager.connect(websocket, application_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            # Persist message
            chat_message = JobChatMessage(
                job_application_id=application_id,
                sender_id=user.id,
                message=data
            )
            db.add(chat_message)
            await db.commit()
            
            # Broadcast formatted message (JSON)
            # Or just send text. For simplicity sending text, ideally JSON.
            # We'll broadcast the same text for now, client handles display.
            # Better: Broadcast structured JSON with sender_id.
            
            response = {
                "sender_id": str(user.id),
                "message": data,
                "created_at": datetime.utcnow().isoformat()
            }
            await manager.broadcast(json.dumps(response), application_id)

    except WebSocketDisconnect:
        manager.disconnect(websocket, application_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, application_id)

class MessageResponse(BaseModel):
    id: UUID
    sender_id: UUID
    message: str
    created_at: datetime
    class Config:
        from_attributes = True

@router.get("/{application_id}/history", response_model=List[MessageResponse])
async def get_chat_history(
    application_id: str,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    # Check permissions logic again
    result = await db.execute(select(JobApplication).options(selectinload(JobApplication.job)).where(JobApplication.id == application_id))
    application = result.scalars().first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
        
    job = application.job
    if (current_user.id != application.applicant_id and 
        current_user.id != job.created_by and 
        not current_user.is_admin):
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(
        select(JobChatMessage)
        .where(JobChatMessage.job_application_id == application_id)
        .order_by(JobChatMessage.created_at.asc())
    )
    return result.scalars().all()
