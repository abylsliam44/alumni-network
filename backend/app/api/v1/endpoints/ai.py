from fastapi import APIRouter, Depends, HTTPException, status
import logging
from sqlalchemy.ext.asyncio import AsyncSession
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
from openai import OpenAI
from openai import OpenAIError

from app.api import deps
from app.core.config import settings
from app.core.database import get_db
from app.schemas.ai import ChatRequest, ChatResponse, AiChatHistoryResponse
from app.models.user import User
from app.models.ai_chat import AiChatMessage as AiChatMessageModel
from sqlalchemy import select

router = APIRouter()
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are an assistant for the Alumni Networking platform of Astana IT University. "
    "Answer ONLY questions related to education, courses, campus life, mentorship, career guidance, "
    "and academic processes at Astana IT University. "
    "If a question is unrelated to Astana IT University or education there, politely decline and ask for a relevant question."
)


def get_openai_client() -> OpenAI | None:
    """Return OpenAI client if configured."""
    if not settings.OPENAI_API_KEY:
        return None
    return OpenAI(api_key=settings.OPENAI_API_KEY)


def get_gemini_model():
    """
    Return a configured Gemini model or raise a clear 503 if the key is missing.
    """
    if not settings.GOOGLE_AI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service not configured (missing GOOGLE_AI_API_KEY)",
        )
    genai.configure(api_key=settings.GOOGLE_AI_API_KEY)
    return genai.GenerativeModel("gemini-1.5-flash-latest")


@router.post("/chat", response_model=ChatResponse)
async def chat_ai(
    payload: ChatRequest,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """
    Simple chat endpoint constrained to AITU education questions.
    """
    prompt = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": payload.question},
    ]

    # Persist user message
    user_msg = AiChatMessageModel(user_id=current_user.id, role="user", content=payload.question)
    db.add(user_msg)

    # Prefer OpenAI if configured
    client = get_openai_client()
    if client:
        logger.info("AI chat using OpenAI provider")
        try:
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=prompt,
                temperature=0.4,
                max_tokens=300,
            )
            choice = resp.choices[0].message
            content = choice.content
            if isinstance(content, list):
                answer = "".join([part.get("text", "") if isinstance(part, dict) else str(part) for part in content])
            else:
                answer = content or ""

            assistant_msg = AiChatMessageModel(user_id=current_user.id, role="assistant", content=answer)
            db.add(assistant_msg)
            await db.commit()
            return ChatResponse(answer=answer)
        except OpenAIError as exc:
            logger.error("AI chat OpenAIError: %s", exc, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI service temporarily unavailable",
            ) from exc
        except Exception as exc:
            logger.error("AI chat unexpected OpenAI error: %s", exc, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI service error",
            ) from exc

    # Fallback to Gemini when OpenAI is not configured
    if not settings.GOOGLE_AI_API_KEY:
        logger.error("AI chat: no OPENAI_API_KEY and no GOOGLE_AI_API_KEY configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service not configured",
        )
    logger.info("AI chat using Gemini provider")
    try:
        model = get_gemini_model()
        chat_text = "\n".join([f"{m['role']}: {m['content']}" for m in prompt])
        resp = model.generate_content(
            chat_text,
            generation_config={"temperature": 0.4, "max_output_tokens": 300},
        )
        answer = resp.text or ""
        assistant_msg = AiChatMessageModel(user_id=current_user.id, role="assistant", content=answer)
        db.add(assistant_msg)
        await db.commit()
    except HTTPException:
        # Bubble up explicit configuration error
        raise
    except google_exceptions.GoogleAPIError as exc:
        logger.error("AI chat GoogleAPIError: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service temporarily unavailable",
        ) from exc
    except Exception as exc:
        logger.error("AI chat unexpected Gemini error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service error",
        ) from exc

    return ChatResponse(answer=answer)


@router.get("/chat/history", response_model=AiChatHistoryResponse)
async def chat_history(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> AiChatHistoryResponse:
    result = await db.execute(
        select(AiChatMessageModel)
        .where(AiChatMessageModel.user_id == current_user.id)
        .order_by(AiChatMessageModel.created_at.asc())
    )
    rows = result.scalars().all()
    return AiChatHistoryResponse(messages=rows)

    return ChatResponse(answer=answer)


