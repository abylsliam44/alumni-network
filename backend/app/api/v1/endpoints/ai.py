from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

from app.api import deps
from app.core.config import settings
from app.core.database import get_db
from app.schemas.ai import ChatRequest, ChatResponse
from app.models.user import User

router = APIRouter()

SYSTEM_PROMPT = (
    "You are an assistant for the Alumni Networking platform of Astana IT University. "
    "Answer ONLY questions related to education, courses, campus life, mentorship, career guidance, "
    "and academic processes at Astana IT University. "
    "If a question is unrelated to Astana IT University or education there, politely decline and ask for a relevant question."
)


def get_model():
    if not settings.GOOGLE_AI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI key not configured",
        )
    genai.configure(api_key=settings.GOOGLE_AI_API_KEY)
    return genai.GenerativeModel("gemini-1.5-flash")


@router.post("/chat", response_model=ChatResponse)
async def chat_ai(
    payload: ChatRequest,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """
    Simple chat endpoint constrained to AITU education questions.
    """
    model = get_model()
    try:
        prompt = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": payload.question},
        ]
        # Gemini expects a single text prompt; join messages
        chat_text = "\n".join([f"{m['role']}: {m['content']}" for m in prompt])
        resp = model.generate_content(chat_text, generation_config={"temperature": 0.4, "max_output_tokens": 300})
        answer = resp.text or ""
    except google_exceptions.GoogleAPIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service temporarily unavailable",
        ) from exc

    return ChatResponse(answer=answer)


