from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
import logging
import tempfile
import os
from sqlalchemy.ext.asyncio import AsyncSession
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
from openai import OpenAI
from openai import OpenAIError

from app.api import deps
from app.core.config import settings
from app.core.database import get_db
from app.schemas.ai import (
    ChatRequest,
    ChatResponse,
    AiChatHistoryResponse,
    KnowledgeBaseUploadResponse,
    KnowledgeBaseStatsResponse,
    KnowledgeBaseClearResponse,
)
from app.models.user import User
from app.models.ai_chat import AiChatMessage as AiChatMessageModel
from sqlalchemy import select

# Import RAG service
from app.ai.rag_service import rag_service

router = APIRouter()
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the official AI assistant for the AITU Alumni Network platform.

## YOUR PRIMARY ROLE

You help users with:
1. **AITU Information** - Answer ANY question about AITU (Astana IT University): programs, academic mobility, schedules, rules, campus, faculty, admissions, student life, etc.
2. **Platform Help** - Explain how to use features of this Alumni Network platform

## CRITICAL RULES

1. **ENGLISH ONLY**: Always respond in English, regardless of what language the user writes in.

2. **KNOWLEDGE BASE IS IN RUSSIAN**: The AITU Knowledge Base documents are written in Russian. You MUST:
   - Read and understand the Russian content
   - Translate the relevant information into English when answering
   - Never say you can't understand the content - it's official AITU documentation in Russian

3. **USE THE KNOWLEDGE BASE**: When users ask about AITU topics, ALWAYS use the information provided in the "Relevant Information from AITU Knowledge Base" section below. This is your primary source of AITU information. Translate Russian content to English in your response.

4. **ANSWER AITU QUESTIONS**: If the question mentions AITU, university programs, academic mobility, student services, campus life, faculty, admissions, or any university-related topic - ANSWER IT using the knowledge base.

5. **DECLINE ONLY NON-AITU TOPICS**: Only decline questions that are COMPLETELY unrelated to AITU or this platform. Examples of what to DECLINE:
   - "What's the weather today?" - Not AITU related
   - "Write me Python code" - Not AITU related
   - "Tell me about Harvard University" - Different university
   - "Explain quantum physics" - General knowledge, not AITU

   When declining, say: "I'm sorry, I can only help with questions about AITU and this Alumni Network platform. Is there anything about AITU or the platform I can help you with?"

6. **EXAMPLES OF QUESTIONS TO ANSWER**:
   - "What programs does AITU offer?" - ANSWER (AITU topic)
   - "Tell me about academic mobility" - ANSWER (AITU topic)
   - "How do I find a mentor?" - ANSWER (Platform feature)
   - "What are AITU admission requirements?" - ANSWER (AITU topic)
   - "How does the scholarship work at AITU?" - ANSWER (AITU topic)

## Your Knowledge Sources

1. **AITU Knowledge Base** - Information from official AITU documents (provided in context below) - USE THIS!
2. **Platform Features** - Information about how to use this Alumni Network platform

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

1. **AITU Questions**: ALWAYS check the knowledge base context first. If information is provided, use it to answer.
2. **Navigation**: Guide users to find platform features
3. **Feature Explanation**: Explain what each feature does and how to use it
4. **Troubleshooting**: Help with platform-related issues
5. **Best Practices**: Suggest ways to get the most out of the platform

## Response Guidelines
- Always respond in English
- Be helpful, friendly, and concise
- **IMPORTANT**: If the knowledge base context contains relevant information, USE IT to answer the question
- Provide step-by-step instructions when helpful
- If you don't have information about an AITU topic in the knowledge base, say "I don't have specific information about that in my knowledge base, but you can contact AITU administration for more details."
- Only decline questions that are completely unrelated to AITU or this platform
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


def build_prompt_with_context(question: str, context: str) -> list:
    """Build the prompt with RAG context if available."""
    system_content = SYSTEM_PROMPT

    if context:
        system_content += f"""

## Relevant Information from AITU Knowledge Base

**IMPORTANT: The following information was retrieved from official AITU documents. The content is in RUSSIAN. You MUST:**
1. Read and understand the Russian text
2. Use this information to answer the user's question
3. Translate the relevant parts to English in your response

{context}

---

**INSTRUCTIONS**: The above is official AITU documentation in Russian. Understand it, extract relevant information, and respond in English. Do NOT say you cannot help - use this data to answer.
"""

    return [
        {"role": "system", "content": system_content},
        {"role": "user", "content": question},
    ]


@router.post("/chat", response_model=ChatResponse)
async def chat_ai(
    payload: ChatRequest,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """
    AI chat endpoint with RAG support for AITU knowledge base.
    """
    # Get relevant context from knowledge base
    context = rag_service.get_context_for_prompt(payload.question)
    sources_used = bool(context)

    if sources_used:
        logger.info(f"Found relevant context for query: {len(context)} characters")

    # Build prompt with context
    prompt = build_prompt_with_context(payload.question, context)

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
                temperature=0.3,  # Lower for more factual responses
                max_tokens=1500,  # Increased for detailed RAG responses
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
            return ChatResponse(answer=answer, sources_used=sources_used)
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
            generation_config={"temperature": 0.3, "max_output_tokens": 1500},
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

    return ChatResponse(answer=answer, sources_used=sources_used)


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


# ==================== RAG Knowledge Base Endpoints ====================


@router.post("/knowledge-base/upload", response_model=KnowledgeBaseUploadResponse)
async def upload_knowledge_base(
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user),
) -> KnowledgeBaseUploadResponse:
    """
    Upload a PDF file to the knowledge base.
    Only admins can upload to the knowledge base.
    """
    # Check if user is admin
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can upload to the knowledge base",
        )

    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported",
        )

    # Save file temporarily and process
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        # Get source name from filename (without extension)
        source_name = os.path.splitext(file.filename)[0]

        # Index the PDF
        result = rag_service.index_pdf(tmp_path, source_name)

        return KnowledgeBaseUploadResponse(**result)

    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error processing PDF: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing PDF: {str(e)}",
        )
    finally:
        # Clean up temp file
        if "tmp_path" in locals():
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


@router.get("/knowledge-base/stats", response_model=KnowledgeBaseStatsResponse)
async def get_knowledge_base_stats(
    current_user: User = Depends(deps.get_current_active_user),
) -> KnowledgeBaseStatsResponse:
    """
    Get statistics about the knowledge base.
    """
    stats = rag_service.get_stats()
    return KnowledgeBaseStatsResponse(**stats)


@router.delete("/knowledge-base", response_model=KnowledgeBaseClearResponse)
async def clear_knowledge_base(
    current_user: User = Depends(deps.get_current_active_user),
) -> KnowledgeBaseClearResponse:
    """
    Clear all data from the knowledge base.
    Only admins can clear the knowledge base.
    """
    # Check if user is admin
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can clear the knowledge base",
        )

    result = rag_service.clear_knowledge_base()
    return KnowledgeBaseClearResponse(**result)
