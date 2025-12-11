from pydantic import BaseModel, Field
from pydantic import ConfigDict
from datetime import datetime
from typing import List


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=800)


class ChatResponse(BaseModel):
    answer: str


class AiChatMessage(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    role: str
    content: str
    created_at: datetime


class AiChatHistoryResponse(BaseModel):
    messages: List[AiChatMessage]


