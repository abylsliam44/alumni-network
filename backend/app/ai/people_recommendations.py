from __future__ import annotations

"""
[MVP v2] People recommendations agent for mentorship matching.

Implements an autonomous LangChain runnable pipeline that:
- loads the current user's profile
- builds/refreshes an embedding in Qdrant
- runs a vector search with mentoring-aware filters
- returns scored matches with shared skills/interests and a short reason
"""

import logging

logger = logging.getLogger(__name__)

import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from langchain_core.runnables import RunnableLambda, RunnableSequence
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
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
MIN_PROFILE_COMPLETENESS = 0.35
VECTOR_SEARCH_LIMIT = 60
MAX_RETURNED_ITEMS = 20


def _get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer

        _embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _embedding_model


def _get_qdrant_client() -> QdrantClient:
    global _qdrant_client
    if _qdrant_client is None:
        logger.info(f"Initializing Qdrant client with URL: {settings.QDRANT_URL}")
        try:
            _qdrant_client = QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY,
                timeout=10.0,
            )
            logger.info("Qdrant client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Qdrant client: {e}")
            raise
    return _qdrant_client


def _get_chat_model() -> Optional[ChatOpenAI]:
    global _chat_model
    if _chat_model:
        return _chat_model

    if not settings.OPENAI_API_KEY:
        return None

    _chat_model = ChatOpenAI(
        model="gpt-4o-mini",
        openai_api_key=settings.OPENAI_API_KEY,
        temperature=0.25,
        max_tokens=200,
    )
    return _chat_model


def _as_list(value: Any) -> List[Any]:
    if isinstance(value, list):
        return [v for v in value if v not in (None, "")]
    if isinstance(value, dict):
        return [v for v in value.values() if v not in (None, "")]
    return []


def _coerce_education_strings(education: Any) -> List[str]:
    entries = []
    edu_items = []
    if isinstance(education, list):
        edu_items = education
    elif isinstance(education, dict):
        edu_items = [education]
    for edu in edu_items:
        school = edu.get("school") or edu.get("university") or edu.get("institution") or ""
        degree = edu.get("degree") or edu.get("field_of_study") or edu.get("program") or ""
        year = edu.get("year") or edu.get("graduation_year") or ""
        parts = [p for p in [degree, school, f"year {year}" if year else ""] if p]
        if parts:
            entries.append(", ".join(parts))
    return entries


def _coerce_experience_strings(experience: Any) -> List[str]:
    entries = []
    if isinstance(experience, list):
        for exp in experience:
            role = exp.get("title") or exp.get("role") or exp.get("position") or ""
            company = exp.get("company") or exp.get("organization") or ""
            years = exp.get("years") or exp.get("duration") or ""
            pieces = [p for p in [role, company, years] if p]
            if pieces:
                entries.append(" at ".join(pieces[:2]) if len(pieces) >= 2 else pieces[0])
    elif isinstance(experience, dict):
        # Some legacy profiles keep a single experience dict
        role = experience.get("title") or experience.get("role") or ""
        company = experience.get("company") or ""
        if role or company:
            text = " ".join(
                [part for part in [role, "at" if role and company else "", company] if part]
            )
            entries.append(text)
    return entries


def _collect_interests(profile: UserProfile) -> List[str]:
    items = []
    if profile.mentor_areas_of_help:
        items.extend(_as_list(profile.mentor_areas_of_help))
    if isinstance(profile.career_interests, list):
        items.extend([v for v in profile.career_interests if v])
    elif isinstance(profile.career_interests, dict):
        items.extend([v for v in profile.career_interests.values() if v])
    return list({v for v in items if v})


def _profile_completeness(profile: UserProfile) -> float:
    signals = [
        _as_list(profile.skills),
        _as_list(profile.mentor_industries),
        _as_list(profile.mentor_areas_of_help),
        _collect_interests(profile),
        _coerce_experience_strings(profile.experience),
        _coerce_education_strings(profile.education),
        [profile.mentor_headline] if profile.mentor_headline else [],
        [profile.location] if profile.location else [],
        [profile.graduation_year] if profile.graduation_year else [],
    ]
    filled = sum(1 for s in signals if s)
    return round(filled / len(signals), 3) if signals else 0.0


def _profile_has_minimal_signal(profile: UserProfile) -> bool:
    if not profile:
        return False
    return _profile_completeness(profile) >= MIN_PROFILE_COMPLETENESS


def _merged_interests_from_payload(payload: Dict[str, Any]) -> List[str]:
    interests = []
    for key in ("career_interests", "mentor_areas_of_help"):
        value = payload.get(key)
        if isinstance(value, list):
            interests.extend([v for v in value if v])
        elif isinstance(value, dict):
            interests.extend([v for v in value.values() if v])
    return list({v for v in interests if v})


async def _embed_text(text: str) -> List[float]:
    model = _get_embedding_model()
    # Use a thread to avoid blocking the event loop
    vector = await asyncio.to_thread(model.encode, text, normalize_embeddings=True)
    return vector.tolist()


def _ensure_collection(client: QdrantClient, vector_size: int) -> None:
    try:
        has = client.get_collection(COLLECTION_NAME)
        if has:
            logger.debug(f"Collection '{COLLECTION_NAME}' already exists")
            return
    except Exception as e:
        logger.info(f"Collection '{COLLECTION_NAME}' not found, will create. Error: {e}")
    
    logger.info(f"Creating collection '{COLLECTION_NAME}' with vector_size={vector_size}")
    try:
        client.recreate_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=qmodels.VectorParams(size=vector_size, distance=qmodels.Distance.COSINE),
        )
        logger.info(f"Collection '{COLLECTION_NAME}' created successfully")
    except Exception as e:
        logger.error(f"Failed to create collection '{COLLECTION_NAME}': {e}")
        raise


def build_user_interest_text(user: User, profile: UserProfile) -> str:
    skills = ", ".join(_as_list(profile.skills))
    industries = ", ".join(_as_list(profile.mentor_industries))
    areas = ", ".join(_as_list(profile.mentor_areas_of_help))
    interests = ", ".join(_collect_interests(profile))
    experiences = "; ".join(_coerce_experience_strings(profile.experience)[:3])
    education = "; ".join(_coerce_education_strings(profile.education)[:2])
    availability = profile.availability or profile.mentor_availability_note
    role_label = "Mentor" if user.is_mentor else user.role.value.title()
    parts = [
        f"{user.name} is a {role_label} from Astana IT University.",
        f"Bio: {user.bio}" if getattr(user, "bio", None) else "",
        f"Education: {education}" if education else "",
        f"Experience: {experiences}" if experiences else "",
        f"Key skills: {skills}" if skills else "",
        f"Industries: {industries}" if industries else "",
        f"Can help with: {areas}" if areas else "",
        f"Interests: {interests}" if interests else "",
        f"Availability: {availability}" if availability else "",
        f"Location: {profile.location}" if profile.location else "",
        f"Graduation year: {profile.graduation_year}" if profile.graduation_year else "",
    ]
    text = ". ".join([p for p in parts if p]).strip()
    return text or f"{user.name} is part of the alumni community."


def _metadata_from_profile(user: User, profile: UserProfile) -> Dict[str, Any]:
    available_for_mentorship = bool(user.is_mentor and profile.mentor_consent)
    career_interests = _collect_interests(profile)
    education_entries = _coerce_education_strings(profile.education)
    experience_entries = _coerce_experience_strings(profile.experience)
    completeness = _profile_completeness(profile)

    metadata: Dict[str, Any] = {
        "id": str(user.id),
        "role": user.role.value,
        "is_mentor": user.is_mentor,
        "available_for_mentorship": available_for_mentorship,
        "skills": _as_list(profile.skills),
        "skills_count": len(_as_list(profile.skills)),
        "industries": _as_list(profile.mentor_industries),
        "career_interests": career_interests,
        "mentor_areas_of_help": _as_list(profile.mentor_areas_of_help),
        "career_focus": career_interests,
        "graduation_year": profile.graduation_year,
        "location": profile.location,
        "name": user.name,
        "photo_url": user.photo_url,
        "mentor_headline": profile.mentor_headline,
        "mentor_availability_note": profile.mentor_availability_note,
        "education": education_entries,
        "experience": experience_entries,
        "profile_completeness": completeness,
        "bio": getattr(user, "bio", None),
    }
    return metadata


async def upsert_user_embedding(
    user: User, profile: UserProfile, summary_text: Optional[str] = None
) -> Optional[List[float]]:
    logger.debug(f"upsert_user_embedding called for user_id={user.id}")
    
    if not profile:
        logger.warning(f"User {user.id} has no profile, skipping embedding")
        return None
    
    completeness = _profile_completeness(profile)
    if not _profile_has_minimal_signal(profile):
        logger.warning(
            f"User {user.id} profile completeness {completeness:.2f} < {MIN_PROFILE_COMPLETENESS}, skipping embedding"
        )
        return None
    
    text = summary_text or build_user_interest_text(user, profile)
    if not text:
        logger.warning(f"User {user.id} has empty profile text, skipping embedding")
        return None
    
    logger.info(f"Generating embedding for user {user.id} (completeness={completeness:.2f})")
    
    try:
        vector = await _embed_text(text)
        logger.debug(f"Generated vector of size {len(vector)} for user {user.id}")
    except Exception as e:
        logger.error(f"Failed to generate embedding for user {user.id}: {e}", exc_info=True)
        return None
    
    metadata = _metadata_from_profile(user, profile)
    
    try:
        client = _get_qdrant_client()
        _ensure_collection(client, len(vector))
    except Exception as e:
        logger.error(f"Failed to get Qdrant client or ensure collection: {e}", exc_info=True)
        return None
    
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
        logger.info(f"Successfully upserted embedding for user {user.id}")
    except Exception as e:
        logger.error(f"Failed to upsert embedding for user {user.id}: {e}", exc_info=True)
        return None
    
    return vector


def _composite_match_score(
    similarity: Optional[float],
    shared_skills: List[str],
    shared_interests: List[str],
    payload: Dict[str, Any],
    current_profile: UserProfile,
) -> int:
    """
    Heuristic score combining vector similarity + structured overlaps.
    Tuned to spread scores so non-trivial overlaps surface >33%.
    """
    score = 0.0
    if similarity is not None:
        score += max(0.0, min(1.0, similarity)) * 60  # dominant factor

    # Overlaps
    score += min(3, len(shared_skills)) * 10  # up to +30
    score += min(3, len(shared_interests)) * 8  # up to +24

    # Location proximity
    loc_a = (current_profile.location or "").strip().lower()
    loc_b = (payload.get("location") or "").strip().lower()
    if loc_a and loc_b and loc_a == loc_b:
        score += 6

    # Mentor availability
    if payload.get("available_for_mentorship"):
        score += 6

    # Profile quality bonus
    completeness = payload.get("profile_completeness") or 0.0
    score += min(10.0, max(0.0, completeness * 10.0))

    return int(round(min(100.0, score)))


def _shared_lists(a: List[str], b: List[str]) -> List[str]:
    return list({x for x in a or [] if x in (b or [])})


async def _enrich_reasons_with_llm(
    items: List[Dict[str, Any]], current: Dict[str, Any], profile_summary: str = ""
) -> List[Dict[str, Any]]:
    """
    Optional single-shot LLM summarization to make reason_short crisper using RAG-style
    context (profile summaries + vector-store payloads).
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
                    "You generate concise mentorship/job fit rationales for an alumni network. "
                    "Use ONLY the provided facts; do not invent any details. "
                    "Rules:\n"
                    "- Start with overlap of skills/interests; mention experience/industry if relevant.\n"
                    "- Add availability or location only if explicitly listed.\n"
                    "- One sentence per candidate, 12–24 words, confident and specific.\n"
                    "- Never add companies/titles/skills not present in the candidate context."
                ),
            ),
            (
                "user",
                (
                    "Current user summary: {current_summary}\n"
                    "Current user interests: {current_interests}\n"
                    "Candidates (one per line):\n"
                    "{candidates}\n"
                    "Return one line per candidate in the same order, no numbering."
                ),
            ),
        ]
    )

    def _candidate_line(it: Dict[str, Any]) -> str:
        return (
            f"- name: {it.get('name')}, role: {it.get('role')}, "
            f"skills: {', '.join(it.get('shared_skills', []) or [])}, "
            f"interests: {', '.join(it.get('shared_interests', []) or [])}, "
            f"industries: {', '.join(it.get('industries', []) or [])}, "
            f"experience: {', '.join(it.get('experience', [])[:2] or [])}, "
            f"education: {', '.join(it.get('education', [])[:1] or [])}, "
            f"availability: {it.get('mentor_availability_note') or ''}, "
            f"location: {it.get('location') or ''}"
        )

    candidates_block = "\n".join([_candidate_line(it) for it in items])

    try:
        chain = prompt | chat
        resp = await chain.ainvoke(
            {
                "current_summary": profile_summary or "AITU community member",
                "current_interests": ", ".join(
                    current.get("career_focus") or current.get("career_interests") or []
                ),
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


async def _fallback_recommendations(
    ctx: Dict[str, Any], reason_seed: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Deterministic overlap-based matching used when Qdrant/embeddings are unavailable.
    """
    db: AsyncSession = ctx["db"]
    user: User = ctx["user"]
    profile: UserProfile = ctx["profile"]

    result = await db.execute(select(User).options(selectinload(User.profile)))
    candidates = result.scalars().all()

    target_roles = ["ALUMNI", "STUDENT"]
    if user.role == UserRole.STUDENT:
        target_roles = ["ALUMNI"]
    elif user.is_mentor:
        target_roles = ["STUDENT"]

    items: List[Dict[str, Any]] = []
    for candidate in candidates:
        if candidate.id == user.id or not candidate.profile:
            continue
        if not _profile_has_minimal_signal(candidate.profile):
            continue
        if candidate.role.value not in target_roles:
            continue
        # Note: Removed strict mentor_consent requirement for students
        # to show all Alumni, prioritizing mentors in scoring instead

        candidate_meta = _metadata_from_profile(candidate, candidate.profile)
        shared_skills = _shared_lists(profile.skills or [], candidate.profile.skills or [])
        shared_interests = _shared_lists(
            reason_seed.get("career_focus", reason_seed.get("career_interests", [])),
            candidate_meta.get("career_focus", candidate_meta.get("career_interests", [])),
        )

        # Note: Removed strict requirement for shared skills/interests
        # Now we show candidates even without overlap, but with lower scores

        # Base similarity is higher if there's any overlap
        base_similarity = 0.4 if (shared_skills or shared_interests) else 0.2

        match_score = _composite_match_score(
            similarity=base_similarity,
            shared_skills=shared_skills,
            shared_interests=shared_interests,
            payload=candidate_meta,
            current_profile=profile,
        )

        reason_parts = []
        if shared_skills:
            reason_parts.append(f"Shared skills: {', '.join(shared_skills[:3])}")
        if shared_interests:
            reason_parts.append(f"Interests overlap: {', '.join(shared_interests[:2])}")
        if not reason_parts:
            # Generate a reason even without direct overlap
            if candidate.is_mentor:
                reason_parts.append("Available as mentor")
            if candidate_meta.get("industries"):
                reason_parts.append(f"Works in: {', '.join(candidate_meta['industries'][:2])}")
            if candidate_meta.get("experience"):
                reason_parts.append("Has relevant experience")
            if not reason_parts:
                reason_parts.append("Part of AITU community")
        reason = " | ".join(reason_parts)

        items.append(
            {
                "target_user_id": str(candidate.id),
                "name": candidate.name,
                "photo_url": candidate.photo_url,
                "role": candidate.role.value,
                "available_for_mentorship": bool(
                    candidate.is_mentor and candidate.profile.mentor_consent
                ),
                "match_score": match_score,
                "shared_skills": shared_skills,
                "shared_interests": shared_interests,
                "reason_short": reason or "Profile overlap detected.",
                "graduation_year": candidate.profile.graduation_year,
                "location": candidate.profile.location,
                "mentor_headline": candidate.profile.mentor_headline,
                "mentor_availability_note": candidate.profile.mentor_availability_note,
                "industries": candidate.profile.mentor_industries or [],
                "mentor_areas_of_help": candidate.profile.mentor_areas_of_help or [],
                "career_interests": candidate_meta.get("career_focus", []),
                "profile_completeness": candidate_meta.get("profile_completeness", 0.0),
                "experience": candidate_meta.get("experience", []),
                "education": candidate_meta.get("education", []),
            }
        )

    items = sorted(items, key=lambda x: x["match_score"], reverse=True)[:MAX_RETURNED_ITEMS]
    return await _enrich_reasons_with_llm(
        items, reason_seed, ctx.get("profile_summary", "")
    )


async def _last_resort_recommendations(ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Last resort: show any users with filled profiles when no other matches found.
    This ensures users always see some recommendations.
    """
    db: AsyncSession = ctx["db"]
    user: User = ctx["user"]

    result = await db.execute(select(User).options(selectinload(User.profile)))
    candidates = result.scalars().all()

    items: List[Dict[str, Any]] = []
    for candidate in candidates:
        if candidate.id == user.id or not candidate.profile:
            continue
        # Only require minimal profile, no role or skill filters
        completeness = _profile_completeness(candidate.profile)
        if completeness < 0.2:  # Very low threshold
            continue

        candidate_meta = _metadata_from_profile(candidate, candidate.profile)

        # Build a generic reason
        reason_parts = []
        if candidate.is_mentor:
            reason_parts.append("Available as mentor")
        if candidate.role.value == "ALUMNI":
            reason_parts.append("AITU Alumni")
        elif candidate.role.value == "STUDENT":
            reason_parts.append("AITU Student")
        if candidate_meta.get("industries"):
            reason_parts.append(f"Works in: {', '.join(candidate_meta['industries'][:2])}")
        if not reason_parts:
            reason_parts.append("Part of AITU community")

        # Low base score for last resort matches
        match_score = int(round(min(50.0, completeness * 50 + 10)))

        items.append(
            {
                "target_user_id": str(candidate.id),
                "name": candidate.name,
                "photo_url": candidate.photo_url,
                "role": candidate.role.value,
                "available_for_mentorship": bool(
                    candidate.is_mentor and candidate.profile.mentor_consent
                ),
                "match_score": match_score,
                "shared_skills": [],
                "shared_interests": [],
                "reason_short": " | ".join(reason_parts),
                "graduation_year": candidate.profile.graduation_year,
                "location": candidate.profile.location,
                "mentor_headline": candidate.profile.mentor_headline,
                "mentor_availability_note": candidate.profile.mentor_availability_note,
                "industries": candidate.profile.mentor_industries or [],
                "mentor_areas_of_help": candidate.profile.mentor_areas_of_help or [],
                "career_interests": candidate_meta.get("career_focus", []),
                "profile_completeness": completeness,
                "experience": candidate_meta.get("experience", []),
                "education": candidate_meta.get("education", []),
            }
        )

    items = sorted(items, key=lambda x: x["match_score"], reverse=True)[:MAX_RETURNED_ITEMS]
    logger.info(f"Last resort recommendations found {len(items)} candidates")
    return items


async def _bootstrap_embeddings_if_empty(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """
    If Qdrant is empty (fresh deploy), backfill embeddings once so that
    vector search is actually used instead of always falling back.
    """
    logger.info("Checking if Qdrant collection needs bootstrapping...")
    
    try:
        client = _get_qdrant_client()
        # Ensure collection exists first
        _ensure_collection(client, 384)  # all-MiniLM-L6-v2 produces 384-dim vectors
        count = client.count(collection_name=COLLECTION_NAME, exact=False).count
        logger.info(f"Qdrant collection '{COLLECTION_NAME}' has {count} vectors")
        if count and count > 0:
            return ctx
    except Exception as e:
        logger.error(f"Failed to check Qdrant collection count: {e}", exc_info=True)
        return ctx

    logger.info("Qdrant collection is empty, bootstrapping embeddings for all users...")
    
    db: AsyncSession = ctx["db"]
    result = await db.execute(select(User).options(selectinload(User.profile)))
    users = result.scalars().all()
    
    logger.info(f"Found {len(users)} users to process for bootstrapping")
    
    processed = 0
    skipped = 0
    failed = 0
    
    for user in users:
        if user.profile and _profile_has_minimal_signal(user.profile):
            try:
                result = await upsert_user_embedding(user, user.profile)
                if result:
                    processed += 1
                else:
                    skipped += 1
            except Exception as e:
                logger.error(f"Failed to upsert embedding for user {user.id}: {e}")
                failed += 1
        else:
            skipped += 1
    
    logger.info(f"Bootstrap complete: processed={processed}, skipped={skipped}, failed={failed}")
    return ctx


async def _ensure_query_vector(ctx: Dict[str, Any]) -> Dict[str, Any]:
    user: User = ctx["user"]
    profile: UserProfile = ctx["profile"]
    summary = build_user_interest_text(user, profile)
    ctx["profile_summary"] = summary
    vector = await upsert_user_embedding(user, profile, summary_text=summary)
    ctx["query_vector"] = vector
    ctx["metadata"] = _metadata_from_profile(user, profile)
    return ctx


async def _vector_search(ctx: Dict[str, Any]) -> Dict[str, Any]:
    logger.info("Starting _vector_search...")
    
    vector = ctx.get("query_vector")
    user: User = ctx["user"]
    profile: UserProfile = ctx["profile"]
    current_metadata = ctx.get("metadata", {})
    current_interests = _merged_interests_from_payload(current_metadata)

    logger.debug(f"User {user.id} has query_vector: {vector is not None}")

    # Make sure vector store is populated at least once
    ctx = await _bootstrap_embeddings_if_empty(ctx)

    if not vector:
        logger.warning(f"No query vector for user {user.id}, falling back to deterministic recommendations")
        ctx["items"] = await _fallback_recommendations(ctx, current_metadata)
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
    filters.append(
        qmodels.FieldCondition(
            key="profile_completeness",
            range=qmodels.Range(gte=MIN_PROFILE_COMPLETENESS),
        )
    )
    # Note: Removed strict available_for_mentorship filter for students
    # to show all Alumni, not just mentors with consent
    # Exclude self
    must_not = [qmodels.FieldCondition(key="id", match=qmodels.MatchValue(value=str(user.id)))]

    search_filter = qmodels.Filter(
        must=filters,
        must_not=must_not,
    )

    try:
        logger.info(f"Executing vector search for user {user.id} with limit={VECTOR_SEARCH_LIMIT}")
        results = client.search(
            collection_name=COLLECTION_NAME,
            query_vector=vector,
            query_filter=search_filter,
            limit=VECTOR_SEARCH_LIMIT,
            with_payload=True,
            with_vectors=False,
        )
        logger.info(f"Vector search returned {len(results)} results")
    except Exception as e:
        logger.error(f"Vector search failed for user {user.id}: {e}", exc_info=True)
        ctx["items"] = await _fallback_recommendations(ctx, current_metadata)
        return ctx

    items = []
    for res in results:
        payload = res.payload or {}
        target_id = payload.get("id") or res.id
        if str(target_id) == str(user.id):
            continue
        completeness = payload.get("profile_completeness")
        if completeness is None:
            # Older payloads might not have this field; infer a conservative value
            inferred_signal = any(
                [
                    payload.get("skills"),
                    payload.get("career_interests"),
                    payload.get("mentor_areas_of_help"),
                    payload.get("experience"),
                ]
            )
            completeness = 0.4 if inferred_signal else 0.0
        if completeness < MIN_PROFILE_COMPLETENESS:
            continue
        shared_skills = _shared_lists(profile.skills or [], payload.get("skills", []))
        shared_interests = _shared_lists(
            current_interests,
            _merged_interests_from_payload(payload),
        )
        reason_parts = []
        if shared_skills:
            reason_parts.append(f"Shared skills: {', '.join(shared_skills[:3])}")
        if shared_interests:
            reason_parts.append(f"Interests overlap: {', '.join(shared_interests[:2])}")
        if not reason_parts:
            # Generate a reason even without direct overlap
            if payload.get("available_for_mentorship"):
                reason_parts.append("Available as mentor")
            if payload.get("industries"):
                reason_parts.append(f"Works in: {', '.join(payload['industries'][:2])}")
            if payload.get("experience"):
                reason_parts.append("Has relevant experience")
        reason = " | ".join(reason_parts) or "Relevant background alignment."
        items.append(
            {
                "target_user_id": str(target_id),
                "name": payload.get("name"),
                "photo_url": payload.get("photo_url"),
                "role": payload.get("role"),
                "available_for_mentorship": payload.get("available_for_mentorship", False),
                "match_score": _composite_match_score(
                    similarity=res.score or 0,
                    shared_skills=shared_skills,
                    shared_interests=shared_interests,
                    payload=payload,
                    current_profile=profile,
                ),
                "shared_skills": shared_skills,
                "shared_interests": shared_interests,
                "reason_short": reason,
                "graduation_year": payload.get("graduation_year"),
                "location": payload.get("location"),
                "mentor_headline": payload.get("mentor_headline"),
                "mentor_availability_note": payload.get("mentor_availability_note"),
                "industries": payload.get("industries", []),
                "career_interests": payload.get("career_focus")
                or payload.get("career_interests", []),
                "mentor_areas_of_help": payload.get("mentor_areas_of_help", []),
                "profile_completeness": completeness,
                "experience": payload.get("experience", []),
                "education": payload.get("education", []),
            }
        )

    items = sorted(items, key=lambda x: x["match_score"], reverse=True)[:MAX_RETURNED_ITEMS]
    # Optional LLM polish for reasons
    items = await _enrich_reasons_with_llm(
        items, current_metadata, ctx.get("profile_summary", "")
    )

    # If vector search is too sparse, supplement with deterministic matches
    if not items:
        logger.info("Vector search returned no results, trying fallback recommendations")
        items = await _fallback_recommendations(ctx, current_metadata)

    # Last resort: show any users with profiles if still empty
    if not items:
        logger.info("Fallback also empty, trying last resort recommendations")
        items = await _last_resort_recommendations(ctx)

    ctx["items"] = items
    return ctx


async def run_people_recommendations_agent(
    current_user_id: UUID, db: AsyncSession
) -> Dict[str, Any]:
    """
    Executes an autonomous LangChain runnable pipeline to produce recommendations.
    """
    logger.info(f"=== Starting recommendations agent for user {current_user_id} ===")

    async def load_context(_: Dict[str, Any]) -> Dict[str, Any]:
        logger.debug(f"Loading context for user {current_user_id}")
        user, profile = await _fetch_user_with_profile(db, current_user_id)
        logger.debug(f"Loaded user {user.id} with profile completeness: {_profile_completeness(profile):.2f}")
        return {"user": user, "profile": profile, "db": db}

    agent = RunnableSequence(
        RunnableLambda(load_context),
        RunnableLambda(_ensure_query_vector),
        RunnableLambda(_vector_search),
    )
    
    try:
        result = await agent.ainvoke({})
        items = result.get("items", [])
        logger.info(f"=== Recommendations agent completed for user {current_user_id}: {len(items)} items ===")
    except Exception as e:
        logger.error(f"=== Recommendations agent FAILED for user {current_user_id}: {e} ===", exc_info=True)
        raise

    return {
        "user_id": str(current_user_id),
        "generated_at": datetime.utcnow().isoformat(),
        "items": items,
    }

