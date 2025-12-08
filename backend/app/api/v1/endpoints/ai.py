from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from openai import OpenAI, OpenAIError

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


def get_client() -> OpenAI:
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OpenAI API key not configured",
        )
    return OpenAI(api_key=settings.OPENAI_API_KEY)


@router.post("/chat", response_model=ChatResponse)
async def chat_ai(
    payload: ChatRequest,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """
    Simple chat endpoint constrained to AITU education questions.
    """
    client = get_client()
    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": payload.question},
            ],
            temperature=0.4,
            max_tokens=300,
        )
        answer = completion.choices[0].message.content
    except OpenAIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service temporarily unavailable",
        ) from exc

    return ChatResponse(answer=answer)


