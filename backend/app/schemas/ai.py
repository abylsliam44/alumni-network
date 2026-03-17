from pydantic import BaseModel, Field
from pydantic import ConfigDict
from datetime import datetime
from typing import List, Optional


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=800)


class ChatResponse(BaseModel):
    answer: str
    sources_used: bool = False


class AiChatMessage(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    role: str
    content: str
    created_at: datetime


class AiChatHistoryResponse(BaseModel):
    messages: List[AiChatMessage]


# RAG Knowledge Base Schemas
class KnowledgeBaseUploadResponse(BaseModel):
    status: str
    source: Optional[str] = None
    chunks_indexed: Optional[int] = None
    total_characters: Optional[int] = None
    message: Optional[str] = None


class KnowledgeBaseStatsResponse(BaseModel):
    status: str
    collection_name: Optional[str] = None
    total_points: Optional[int] = None
    vector_dimension: Optional[int] = None
    message: Optional[str] = None


class KnowledgeBaseClearResponse(BaseModel):
    status: str
    message: str


