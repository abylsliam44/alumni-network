import logging
from datetime import datetime
from typing import Callable, Awaitable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.resume import (
    ResumeConfirmationStatus,
    ResumeDocumentStatus,
    ResumeExtractionDraft,
    ResumeImportSession,
    ResumeJobStatus,
    ResumeJobType,
    ResumeProcessingJob,
    ResumeProcessingStatus,
)
from app.services.resume_extraction import extract_structured_resume_data, extract_text_from_document

logger = logging.getLogger(__name__)


async def enqueue_resume_job(
    db: AsyncSession,
    import_session_id,
    job_type: ResumeJobType,
    payload: dict | None = None,
) -> ResumeProcessingJob:
    job = ResumeProcessingJob(
        import_session_id=import_session_id,
        job_type=job_type,
        status=ResumeJobStatus.QUEUED,
        payload=payload or {},
    )
    db.add(job)
    await db.flush()
    return job


async def _load_job(db: AsyncSession, job_id) -> ResumeProcessingJob | None:
    result = await db.execute(
        select(ResumeProcessingJob)
        .options(
            selectinload(ResumeProcessingJob.import_session).selectinload(ResumeImportSession.document),
            selectinload(ResumeProcessingJob.import_session).selectinload(ResumeImportSession.draft),
        )
        .where(ResumeProcessingJob.id == job_id)
    )
    return result.scalars().first()


async def claim_resume_job_by_id(db: AsyncSession, job_id) -> ResumeProcessingJob | None:
    result = await db.execute(
        select(ResumeProcessingJob)
        .where(ResumeProcessingJob.id == job_id)
        .with_for_update(skip_locked=True)
    )
    job = result.scalars().first()
    if not job or job.status != ResumeJobStatus.QUEUED:
        return None

    job.status = ResumeJobStatus.RUNNING
    job.attempts += 1
    job.started_at = datetime.utcnow()

    session = await db.get(ResumeImportSession, job.import_session_id)
    if session:
        session.processing_status = ResumeProcessingStatus.RUNNING

    await db.commit()
    return await _load_job(db, job.id)


async def claim_next_resume_job(db: AsyncSession) -> ResumeProcessingJob | None:
    result = await db.execute(
        select(ResumeProcessingJob)
        .where(ResumeProcessingJob.status == ResumeJobStatus.QUEUED)
        .order_by(ResumeProcessingJob.created_at.asc())
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    job = result.scalars().first()
    if not job:
        return None

    job.status = ResumeJobStatus.RUNNING
    job.attempts += 1
    job.started_at = datetime.utcnow()

    session = await db.get(ResumeImportSession, job.import_session_id)
    if session:
        session.processing_status = ResumeProcessingStatus.RUNNING

    await db.commit()
    return await _load_job(db, job.id)


async def _ensure_draft(db: AsyncSession, session: ResumeImportSession) -> ResumeExtractionDraft:
    if session.draft:
        return session.draft

    draft = ResumeExtractionDraft(import_session_id=session.id)
    db.add(draft)
    await db.flush()
    session.draft = draft
    return draft


async def _complete_job(db: AsyncSession, job: ResumeProcessingJob) -> ResumeProcessingJob:
    job.status = ResumeJobStatus.COMPLETED
    job.finished_at = datetime.utcnow()
    await db.commit()
    return await _load_job(db, job.id)


async def _fail_job(db: AsyncSession, job: ResumeProcessingJob, exc: Exception) -> ResumeProcessingJob:
    logger.exception("Resume processing job failed: %s", job.id)
    job.status = ResumeJobStatus.FAILED
    job.error_message = str(exc)
    job.finished_at = datetime.utcnow()

    session = job.import_session
    if session:
        session.processing_status = ResumeProcessingStatus.FAILED
        if session.document:
            session.document.status = ResumeDocumentStatus.FAILED

    await db.commit()
    return await _load_job(db, job.id)


async def _handle_extract_text(db: AsyncSession, job: ResumeProcessingJob) -> None:
    session = job.import_session
    if not session or not session.document:
        raise ValueError("Resume import session is incomplete")

    session.document.status = ResumeDocumentStatus.PROCESSING
    draft = await _ensure_draft(db, session)
    text, metadata = await extract_text_from_document(session.document)
    draft.raw_extracted_text = text
    draft.ocr_metadata = metadata

    await enqueue_resume_job(
        db,
        import_session_id=session.id,
        job_type=ResumeJobType.EXTRACT_STRUCTURED_DATA,
        payload={"source_job_id": str(job.id)},
    )


async def _handle_extract_structured_data(db: AsyncSession, job: ResumeProcessingJob) -> None:
    session = job.import_session
    if not session:
        raise ValueError("Resume import session not found")

    draft = await _ensure_draft(db, session)
    text = draft.raw_extracted_text or ""
    structured, field_confidences, extraction_model, extraction_version = await extract_structured_resume_data(text)
    draft.draft_json = structured
    draft.field_confidences = field_confidences
    draft.extraction_model = extraction_model
    draft.extraction_version = extraction_version

    await enqueue_resume_job(
        db,
        import_session_id=session.id,
        job_type=ResumeJobType.NORMALIZE_DRAFT,
        payload={"source_job_id": str(job.id)},
    )


def _normalize_whitespace(value: str | None) -> str | None:
    if value is None:
        return None
    compact = " ".join(value.split()).strip()
    return compact or None


def _normalize_skill_name(value: str | None) -> str | None:
    normalized = _normalize_whitespace(value)
    if not normalized:
        return None
    return normalized.lower()


async def _handle_normalize_draft(db: AsyncSession, job: ResumeProcessingJob) -> None:
    session = job.import_session
    if not session:
        raise ValueError("Resume import session not found")

    draft = await _ensure_draft(db, session)
    raw = draft.draft_json or {}

    identity = raw.get("identity") or {}
    normalized_identity = {}
    for key, value in identity.items():
        if isinstance(value, dict):
            normalized_identity[key] = {
                **value,
                "value": _normalize_whitespace(value.get("value")) if key != "graduation_year" else value.get("value"),
            }

    normalized_skills: list[dict] = []
    seen_skills: set[str] = set()
    for item in raw.get("skills") or []:
        if not isinstance(item, dict):
            continue
        normalized_name = _normalize_skill_name(item.get("name"))
        if not normalized_name or normalized_name in seen_skills:
            continue
        seen_skills.add(normalized_name)
        normalized_skills.append(
            {
                **item,
                "name": normalized_name,
                "canonical_name": normalized_name,
            }
        )

    normalized_employment = []
    for item in raw.get("employment") or []:
        if not isinstance(item, dict):
            continue
        normalized_employment.append(
            {
                **item,
                "company": _normalize_whitespace(item.get("company")),
                "role": _normalize_whitespace(item.get("role")),
                "location": _normalize_whitespace(item.get("location")),
            }
        )

    normalized_education = []
    for item in raw.get("education") or []:
        if not isinstance(item, dict):
            continue
        normalized_education.append(
            {
                **item,
                "school": _normalize_whitespace(item.get("school")),
                "degree": _normalize_whitespace(item.get("degree")),
                "field_of_study": _normalize_whitespace(item.get("field_of_study")),
                "faculty": _normalize_whitespace(item.get("faculty")),
                "program": _normalize_whitespace(item.get("program")),
            }
        )

    draft.normalized_json = {
        "identity": normalized_identity,
        "education": normalized_education,
        "employment": normalized_employment,
        "skills": normalized_skills,
        "_meta": {
            "normalized_at": datetime.utcnow().isoformat(),
            "requires_manual_review": True,
        },
    }

    session.processing_status = ResumeProcessingStatus.COMPLETED
    session.confirmation_status = ResumeConfirmationStatus.NEEDS_REVIEW
    if session.document:
        session.document.status = ResumeDocumentStatus.PARSED


JOB_HANDLERS: dict[ResumeJobType, Callable[[AsyncSession, ResumeProcessingJob], Awaitable[None]]] = {
    ResumeJobType.EXTRACT_TEXT: _handle_extract_text,
    ResumeJobType.EXTRACT_STRUCTURED_DATA: _handle_extract_structured_data,
    ResumeJobType.NORMALIZE_DRAFT: _handle_normalize_draft,
}


async def process_resume_job(db: AsyncSession, job: ResumeProcessingJob) -> ResumeProcessingJob:
    handler = JOB_HANDLERS.get(job.job_type)
    if not handler:
        return await _fail_job(db, job, ValueError(f"No handler for job type {job.job_type}"))

    try:
        await handler(db, job)
        return await _complete_job(db, job)
    except Exception as exc:
        return await _fail_job(db, job, exc)
