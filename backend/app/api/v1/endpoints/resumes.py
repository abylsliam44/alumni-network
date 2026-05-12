from datetime import datetime
from typing import Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api import deps
from app.core import storage
from app.core.database import get_db
from app.models.resume import (
    ResumeConfirmationStatus,
    ResumeDocument,
    ResumeDocumentStatus,
    ResumeImportSession,
    ResumeJobStatus,
    ResumeJobType,
    ResumeProcessingJob,
    ResumeProcessingStatus,
)
from app.services.resume_confirmation import confirm_resume_import, save_resume_draft_edits
from app.models.user import User
from app.schemas.resume import (
    ResumeConfirmRequest,
    ResumeDraftRead,
    ResumeDraftUpdate,
    ResumeImportCreate,
    ResumeImportListResponse,
    ResumeImportRead,
    ResumeUploadUrlResponse,
)
from app.tasks.resume import dispatch_resume_job

router = APIRouter()

ALLOWED_RESUME_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/webp",
}


def _serialize_import(session: ResumeImportSession) -> ResumeImportRead:
    if not session.document:
        raise HTTPException(status_code=500, detail="Resume import session is missing document")

    jobs = sorted(session.jobs or [], key=lambda item: item.created_at or item.id)
    return ResumeImportRead(
        id=session.id,
        user_id=session.user_id,
        resume_document_id=session.resume_document_id,
        file_url=session.document.file_url,
        object_name=session.document.object_name,
        original_filename=session.document.original_filename,
        mime_type=session.document.mime_type,
        document_status=session.document.status,
        processing_status=session.processing_status,
        confirmation_status=session.confirmation_status,
        processing_consent=session.processing_consent,
        profile_publish_consent=session.profile_publish_consent,
        graph_analytics_consent=session.graph_analytics_consent,
        has_draft=session.draft is not None,
        last_confirmed_at=session.last_confirmed_at,
        last_reviewed_at=session.last_reviewed_at,
        created_at=session.created_at,
        updated_at=session.updated_at,
        jobs=[job for job in jobs],
    )


@router.post("/presigned-url", response_model=ResumeUploadUrlResponse)
async def get_resume_upload_url(
    request: Request,
    filename: str = Query(..., min_length=1),
    filetype: str = Query(..., min_length=1),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    if filetype not in ALLOWED_RESUME_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported resume file type")

    return storage.generate_presigned_url(
        file_name=filename,
        file_type=filetype,
        prefix="resume-imports",
        public_endpoint=storage.infer_public_storage_endpoint(request),
    )


@router.post("/imports", response_model=ResumeImportRead, status_code=status.HTTP_201_CREATED)
async def create_resume_import(
    payload: ResumeImportCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    if payload.mime_type not in ALLOWED_RESUME_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported resume file type")
    if not payload.processing_consent:
        raise HTTPException(status_code=400, detail="Processing consent is required")

    document = ResumeDocument(
        user_id=current_user.id,
        file_url=payload.file_url,
        object_name=payload.object_name,
        original_filename=payload.original_filename,
        mime_type=payload.mime_type,
        status=ResumeDocumentStatus.UPLOADED,
    )
    db.add(document)
    await db.flush()

    import_session = ResumeImportSession(
        user_id=current_user.id,
        resume_document_id=document.id,
        processing_status=ResumeProcessingStatus.QUEUED,
        confirmation_status=ResumeConfirmationStatus.DRAFT,
        processing_consent=payload.processing_consent,
        profile_publish_consent=payload.profile_publish_consent,
        graph_analytics_consent=payload.graph_analytics_consent,
    )
    db.add(import_session)
    await db.flush()

    job = ResumeProcessingJob(
        import_session_id=import_session.id,
        job_type=ResumeJobType.EXTRACT_TEXT,
        status=ResumeJobStatus.QUEUED,
        payload={"source": "resume_upload"},
    )
    db.add(job)
    await db.commit()

    try:
        dispatch_resume_job(job.id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Resume processing queue is unavailable",
        ) from exc

    result = await db.execute(
        select(ResumeImportSession)
        .options(
            selectinload(ResumeImportSession.document),
            selectinload(ResumeImportSession.jobs),
            selectinload(ResumeImportSession.draft),
        )
        .where(ResumeImportSession.id == import_session.id)
    )
    session = result.scalars().first()
    return _serialize_import(session)


@router.get("/imports", response_model=ResumeImportListResponse)
async def list_resume_imports(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(
        select(ResumeImportSession)
        .options(
            selectinload(ResumeImportSession.document),
            selectinload(ResumeImportSession.jobs),
            selectinload(ResumeImportSession.draft),
        )
        .where(ResumeImportSession.user_id == current_user.id)
        .order_by(ResumeImportSession.created_at.desc())
    )
    items = [_serialize_import(item) for item in result.scalars().all()]
    return ResumeImportListResponse(items=items)


@router.get("/imports/{import_id}", response_model=ResumeImportRead)
async def get_resume_import(
    import_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(
        select(ResumeImportSession)
        .options(
            selectinload(ResumeImportSession.document),
            selectinload(ResumeImportSession.jobs),
            selectinload(ResumeImportSession.draft),
        )
        .where(
            ResumeImportSession.id == import_id,
            ResumeImportSession.user_id == current_user.id,
        )
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Resume import not found")
    return _serialize_import(session)


@router.get("/imports/{import_id}/draft", response_model=ResumeDraftRead)
async def get_resume_draft(
    import_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(
        select(ResumeImportSession)
        .options(selectinload(ResumeImportSession.draft))
        .where(
            ResumeImportSession.id == import_id,
            ResumeImportSession.user_id == current_user.id,
        )
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Resume import not found")
    if not session.draft:
        raise HTTPException(status_code=404, detail="Resume draft not available yet")
    return session.draft


@router.put("/imports/{import_id}/draft", response_model=ResumeDraftRead)
async def update_resume_draft(
    import_id: UUID,
    payload: ResumeDraftUpdate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(
        select(ResumeImportSession)
        .options(selectinload(ResumeImportSession.draft))
        .where(
            ResumeImportSession.id == import_id,
            ResumeImportSession.user_id == current_user.id,
        )
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Resume import not found")
    if not session.draft:
        raise HTTPException(status_code=404, detail="Resume draft not available yet")

    updated = await save_resume_draft_edits(
        db=db,
        session=session,
        draft_json=payload.draft_json,
        normalized_json=payload.normalized_json,
        field_confidences=payload.field_confidences,
    )
    return updated.draft


@router.post("/imports/{import_id}/confirm", response_model=ResumeImportRead)
async def confirm_resume(
    import_id: UUID,
    payload: ResumeConfirmRequest,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(
        select(ResumeImportSession)
        .options(
            selectinload(ResumeImportSession.document),
            selectinload(ResumeImportSession.jobs),
            selectinload(ResumeImportSession.draft),
        )
        .where(
            ResumeImportSession.id == import_id,
            ResumeImportSession.user_id == current_user.id,
        )
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Resume import not found")
    if not session.draft:
        raise HTTPException(status_code=400, detail="Resume draft not available yet")
    if session.confirmation_status == ResumeConfirmationStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Resume import already confirmed")

    confirmed = await confirm_resume_import(
        db=db,
        session=session,
        current_user=current_user,
        profile_publish_consent=payload.profile_publish_consent,
        graph_analytics_consent=payload.graph_analytics_consent,
    )
    return _serialize_import(confirmed)


@router.post("/imports/{import_id}/reprocess", response_model=ResumeImportRead)
async def requeue_resume_import(
    import_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(
        select(ResumeImportSession)
        .options(
            selectinload(ResumeImportSession.document),
            selectinload(ResumeImportSession.jobs),
            selectinload(ResumeImportSession.draft),
        )
        .where(
            ResumeImportSession.id == import_id,
            ResumeImportSession.user_id == current_user.id,
        )
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Resume import not found")

    session.processing_status = ResumeProcessingStatus.QUEUED
    session.confirmation_status = ResumeConfirmationStatus.NEEDS_REVIEW
    session.last_reviewed_at = datetime.utcnow()
    if session.document:
        session.document.status = ResumeDocumentStatus.UPLOADED

    db.add(
        ResumeProcessingJob(
            import_session_id=session.id,
            job_type=ResumeJobType.EXTRACT_TEXT,
            status=ResumeJobStatus.QUEUED,
            payload={"source": "manual_reprocess"},
        )
    )
    await db.commit()

    result = await db.execute(
        select(ResumeImportSession)
        .options(
            selectinload(ResumeImportSession.document),
            selectinload(ResumeImportSession.jobs),
            selectinload(ResumeImportSession.draft),
        )
        .where(ResumeImportSession.id == session.id)
    )
    updated = result.scalars().first()
    return _serialize_import(updated)
