from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel

from app.models.resume import (
    ResumeConfirmationStatus,
    ResumeDocumentStatus,
    ResumeJobStatus,
    ResumeJobType,
    ResumeProcessingStatus,
)


class ResumeUploadUrlResponse(BaseModel):
    upload_url: str
    file_url: str
    object_name: str


class ResumeImportCreate(BaseModel):
    file_url: str
    object_name: str
    original_filename: str
    mime_type: str
    processing_consent: bool
    profile_publish_consent: bool = False
    graph_analytics_consent: bool = False


class ResumeProcessingJobRead(BaseModel):
    id: UUID
    job_type: ResumeJobType
    status: ResumeJobStatus
    attempts: int = 0
    payload: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ResumeDraftRead(BaseModel):
    id: UUID
    import_session_id: UUID
    raw_extracted_text: Optional[str] = None
    ocr_metadata: Optional[dict[str, Any]] = None
    draft_json: Optional[dict[str, Any]] = None
    normalized_json: Optional[dict[str, Any]] = None
    field_confidences: Optional[dict[str, Any]] = None
    extraction_model: Optional[str] = None
    extraction_version: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ResumeDraftUpdate(BaseModel):
    draft_json: Optional[dict[str, Any]] = None
    normalized_json: Optional[dict[str, Any]] = None
    field_confidences: Optional[dict[str, Any]] = None


class ResumeConfirmRequest(BaseModel):
    profile_publish_consent: Optional[bool] = None
    graph_analytics_consent: Optional[bool] = None


class ResumeImportRead(BaseModel):
    id: UUID
    user_id: UUID
    resume_document_id: UUID
    file_url: str
    object_name: str
    original_filename: str
    mime_type: str
    document_status: ResumeDocumentStatus
    processing_status: ResumeProcessingStatus
    confirmation_status: ResumeConfirmationStatus
    processing_consent: bool
    profile_publish_consent: bool
    graph_analytics_consent: bool
    has_draft: bool = False
    last_confirmed_at: Optional[datetime] = None
    last_reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    jobs: List[ResumeProcessingJobRead] = []


class ResumeImportListResponse(BaseModel):
    items: List[ResumeImportRead]
