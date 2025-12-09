from __future__ import annotations

"""
[MVP v2] People recommendations agent for mentorship matching.

Implements an autonomous LangChain runnable pipeline that:
- loads the current user's profile
- builds/refreshes an embedding in Qdrant
- runs a vector search with mentoring-aware filters
- returns scored matches with shared skills/interests and a short reason
"""

import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from langchain_core.runnables import RunnableLambda, RunnableSequence
from langchain_core.prompts import ChatPromptTemplate
from langchain_community.chat_models import ChatOpenAI
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.user import User, UserProfile, UserRole

COLLECTION_NAME = "users"
_embedding_model = None
_qdrant_client: Optional[QdrantClient] = None
_chat_model: Optional[ChatOpenAI] = None


def _get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer

        _embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _embedding_model


def _get_qdrant_client() -> QdrantClient:
    global _qdrant_client
    if _qdrant_client is None:
        _qdrant_client = QdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY,
            timeout=10.0,
        )
    return _qdrant_client


def _get_chat_model() -> Optional[ChatOpenAI]:
    global _chat_model
    if _chat_model is None and settings.GOOGLE_AI_API_KEY:
        _chat_model = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.2,
            openai_api_key=settings.GOOGLE_AI_API_KEY,
            max_tokens=120,
        )
    return _chat_model


async def _embed_text(text: str) -> List[float]:
    model = _get_embedding_model()
    # Use a thread to avoid blocking the event loop
    vector = await asyncio.to_thread(model.encode, text, normalize_embeddings=True)
    return vector.tolist()


def _ensure_collection(client: QdrantClient, vector_size: int) -> None:
    try:
        has = client.get_collection(COLLECTION_NAME)
        if has:
            return
    except Exception:
        # Collection not found
        pass
    client.recreate_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=qmodels.VectorParams(size=vector_size, distance=qmodels.Distance.COSINE),
    )


def build_user_interest_text(user: User, profile: UserProfile) -> str:
    skills = ", ".join(profile.skills or [])
    industries = ", ".join(profile.mentor_industries or [])
    areas = ", ".join(profile.mentor_areas_of_help or [])
    education = ""
    if profile.education:
        edu = profile.education[0]
        degree = edu.get("degree") or edu.get("field_of_study") or ""
        education = f"studied {degree} at {edu.get('school','')}"
    role_label = "Mentor" if user.is_mentor else user.role.value.title()
    parts = [
        f"{user.name} is a {role_label} from Astana IT University.",
        education,
        f"Key skills: {skills}" if skills else "",
        f"Industries: {industries}" if industries else "",
        f"Can help with: {areas}" if areas else "",
        f"Availability: {profile.availability}" if profile.availability else "",
    ]
    text = ". ".join([p for p in parts if p]).strip()
    return text or f"{user.name} is part of the alumni community."


def _metadata_from_profile(user: User, profile: UserProfile) -> Dict[str, Any]:
    available_for_mentorship = bool(user.is_mentor and profile.mentor_consent)
    career_interests = []
    if profile.mentor_areas_of_help:
        career_interests.extend(profile.mentor_areas_of_help)
    if isinstance(profile.career_interests, list):
        career_interests.extend(profile.career_interests)
    elif isinstance(profile.career_interests, dict):
        career_interests.extend(profile.career_interests.values())

    metadata: Dict[str, Any] = {
        "id": str(user.id),
        "role": user.role.value,
        "is_mentor": user.is_mentor,
        "available_for_mentorship": available_for_mentorship,
        "skills": profile.skills or [],
        "industries": profile.mentor_industries or [],
        "career_interests": career_interests,
        "graduation_year": profile.graduation_year,
        "location": profile.location,
        "name": user.name,
        "photo_url": user.photo_url,
        "mentor_headline": profile.mentor_headline,
        "mentor_availability_note": profile.mentor_availability_note,
    }
    return metadata


async def upsert_user_embedding(user: User, profile: UserProfile) -> Optional[List[float]]:
    if not profile:
        return None
    text = build_user_interest_text(user, profile)
    vector = await _embed_text(text)
    metadata = _metadata_from_profile(user, profile)
    client = _get_qdrant_client()
    _ensure_collection(client, len(vector))
    try:
        client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                qmodels.PointStruct(
                    id=str(user.id),
                    vector=vector,
                    payload=metadata,
                )
            ],
        )
    except Exception:
        # Do not fail the main request if vector store is unavailable
        return None
    return vector


def _match_score(similarity: float) -> int:
    if similarity < 0.65:
        return 0
    return int(round(((similarity - 0.65) / 0.35) * 100))


def _shared_lists(a: List[str], b: List[str]) -> List[str]:
    return list({x for x in a or [] if x in (b or [])})


async def _enrich_reasons_with_llm(items: List[Dict[str, Any]], current: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Optional single-shot LLM summarization to make reason_short crisper.
    Executes once per request; falls back silently on failure.
    """
    if not items:
        return items
    chat = _get_chat_model()
    if not chat:
        return items

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                (
                    "You are an assistant for an alumni mentorship platform that generates a single, "
                    "crisp rationale for each candidate using ONLY the structured data provided. "
                    "Rules:\n"
                    "- Use shared skills and shared interests as the primary evidence; mention at most 2–3 items total.\n"
                    "- Never invent employers, titles, locations, or skills beyond what is listed.\n"
                    "- Keep it one sentence, 12–22 words, confident and positive.\n"
                    "- Avoid fluff (e.g., 'highly recommended'); be factual and specific.\n"
                    "- Respond in English only."
                ),
            ),
            (
                "user",
                (
                    "Current user skills: {skills}\n"
                    "Current user interests: {interests}\n"
                    "Candidates:\n"
                    "{candidates}\n"
                    "Return one line per candidate in the same order, without numbering."
                ),
            ),
        ]
    )

    candidates_block = "\n".join(
        [
            f"- name: {it.get('name')}, skills: {', '.join(it.get('shared_skills', []) or [])}, "
            f"interests: {', '.join(it.get('shared_interests', []) or [])}"
            for it in items
        ]
    )

    try:
        chain = prompt | chat
        resp = await chain.ainvoke(
            {
                "skills": ", ".join(current.get("skills", [])),
                "interests": ", ".join(current.get("career_interests", [])),
                "candidates": candidates_block,
            }
        )
        lines = [ln.strip("- ").strip() for ln in resp.content.split("\n") if ln.strip()]
        if lines:
            for idx, line in enumerate(lines):
                if idx < len(items) and line:
                    items[idx]["reason_short"] = line
    except Exception:
        # On any failure, return original reasons
        return items
    return items


async def _fetch_user_with_profile(db: AsyncSession, user_id: UUID) -> Tuple[User, UserProfile]:
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == user_id)
    )
    user = result.scalars().first()
    if not user:
        raise ValueError("User not found")
    if not user.profile:
        user.profile = UserProfile(user_id=user.id)
    return user, user.profile


async def _ensure_query_vector(ctx: Dict[str, Any]) -> Dict[str, Any]:
    user: User = ctx["user"]
    profile: UserProfile = ctx["profile"]
    vector = await upsert_user_embedding(user, profile)
    ctx["query_vector"] = vector
    ctx["metadata"] = _metadata_from_profile(user, profile)
    return ctx


async def _vector_search(ctx: Dict[str, Any]) -> Dict[str, Any]:
    vector = ctx.get("query_vector")
    user: User = ctx["user"]
    profile: UserProfile = ctx["profile"]

    if not vector:
        ctx["items"] = []
        return ctx

    client = _get_qdrant_client()
    target_roles = ["ALUMNI", "STUDENT"]
    if user.role == UserRole.STUDENT:
        target_roles = ["ALUMNI"]
    elif user.is_mentor:
        target_roles = ["STUDENT"]

    filters: List[qmodels.FieldCondition] = [
        qmodels.FieldCondition(
            key="role",
            match=qmodels.MatchAny(any=target_roles),
        )
    ]
    if user.role == UserRole.STUDENT:
        filters.append(
            qmodels.FieldCondition(
                key="available_for_mentorship",
                match=qmodels.MatchValue(value=True),
            )
        )
    # Exclude self
    must_not = [qmodels.FieldCondition(key="id", match=qmodels.MatchValue(value=str(user.id)))]

    search_filter = qmodels.Filter(
        must=filters,
        must_not=must_not,
    )

    try:
        results = client.search(
            collection_name=COLLECTION_NAME,
            query_vector=vector,
            query_filter=search_filter,
            limit=50,
            with_payload=True,
            with_vectors=False,
        )
    except Exception:
        ctx["items"] = []
        return ctx

    items = []
    for res in results:
        payload = res.payload or {}
        target_id = payload.get("id") or res.id
        if str(target_id) == str(user.id):
            continue
        shared_skills = _shared_lists(profile.skills or [], payload.get("skills", []))
        shared_interests = _shared_lists(
            _metadata_from_profile(user, profile).get("career_interests", []),
            payload.get("career_interests", []),
        )
        reason_parts = []
        if shared_skills:
            reason_parts.append(f"Shared skills: {', '.join(shared_skills[:3])}")
        if shared_interests:
            reason_parts.append(f"Interests overlap: {', '.join(shared_interests[:2])}")
        reason = " | ".join(reason_parts) or "Relevant background alignment."
        items.append(
            {
                "target_user_id": str(target_id),
                "name": payload.get("name"),
                "photo_url": payload.get("photo_url"),
                "role": payload.get("role"),
                "available_for_mentorship": payload.get("available_for_mentorship", False),
                "match_score": _match_score(res.score or 0),
                "shared_skills": shared_skills,
                "shared_interests": shared_interests,
                "reason_short": reason,
                "graduation_year": payload.get("graduation_year"),
                "location": payload.get("location"),
                "mentor_headline": payload.get("mentor_headline"),
                "mentor_availability_note": payload.get("mentor_availability_note"),
            }
        )

    items = sorted(items, key=lambda x: x["match_score"], reverse=True)[:20]
    # Optional LLM polish for reasons
    items = await _enrich_reasons_with_llm(items, ctx.get("metadata", {}))
    ctx["items"] = items
    return ctx


async def run_people_recommendations_agent(
    current_user_id: UUID, db: AsyncSession
) -> Dict[str, Any]:
    """
    Executes an autonomous LangChain runnable pipeline to produce recommendations.
    """

    async def load_context(_: Dict[str, Any]) -> Dict[str, Any]:
        user, profile = await _fetch_user_with_profile(db, current_user_id)
        return {"user": user, "profile": profile}

    agent = RunnableSequence(
        RunnableLambda(load_context),
        RunnableLambda(_ensure_query_vector),
        RunnableLambda(_vector_search),
    )
    result = await agent.ainvoke({})

    return {
        "user_id": str(current_user_id),
        "generated_at": datetime.utcnow().isoformat(),
        "items": result.get("items", []),
    }

