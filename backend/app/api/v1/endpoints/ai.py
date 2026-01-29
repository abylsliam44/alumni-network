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

SYSTEM_PROMPT = """You are a helpful AI assistant for the Alumni Network platform. Your role is to help users navigate and use the platform effectively.

## Platform Features

### Dashboard
- View your profile summary and stats
- See upcoming events on the calendar
- Quick actions for common tasks (View Profile, Find Mentors, Browse Events, Explore Jobs)
- Personalized recommendations for connections
- Recent job postings from the community

### Profile
- Edit your personal information and bio
- Add education history (university, degree, year)
- Add work experience
- List your skills and interests
- Upload a profile photo
- Track profile completeness

### Member Directory
- Browse all members of the alumni network
- Search by name, role, or interests
- Filter by graduation year, role (Student, Alumni, Mentor, Admin)
- View detailed member profiles
- Send connection requests

### Connections & Friends
- Send and receive connection requests
- View pending requests (incoming and outgoing)
- Manage your connections
- See mutual connections

### Mentorship
- Find mentors in your field of interest
- Become a mentor to help students and junior alumni
- Browse available mentors by expertise
- Request mentorship connections
- Get career guidance and advice

### Messages
- Send direct messages to your connections
- Real-time chat with other members
- View message history
- Search through conversations

### Events
- Browse upcoming community events
- View event details (date, time, location)
- See events on the dashboard calendar
- Connect with attendees

### Jobs
- Browse job postings shared by alumni
- Filter by company, location, or type
- View job details and requirements
- Apply to opportunities

### AI Recommendations
- Get personalized people recommendations
- See match scores based on shared interests and skills
- Understand why someone is recommended (shared interests, similar background)
- Connect with recommended alumni

### Settings
- Update account settings
- Toggle between light and dark theme
- Manage notification preferences
- Update privacy settings

## How to Help Users

1. **Navigation**: Guide users to find features (e.g., "To edit your profile, click on your avatar and select Edit Profile")
2. **Feature Explanation**: Explain what each feature does and how to use it
3. **Troubleshooting**: Help with common issues
4. **Best Practices**: Suggest ways to get the most out of the platform (e.g., "Complete your profile to get better recommendations")

## Guidelines
- Be helpful, friendly, and concise
- Provide step-by-step instructions when helpful
- If asked about something unrelated to the platform, politely redirect and offer to help with platform features
- Encourage users to explore different features
"""


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
