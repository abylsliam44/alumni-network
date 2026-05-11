import asyncio
import logging
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select

from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.resume import ResumeJobStatus, ResumeProcessingJob
from app.services.resume_processing import claim_resume_job_by_id, process_resume_job

logger = logging.getLogger(__name__)


def dispatch_resume_job(job_id) -> None:
    process_resume_job_task.apply_async(args=[str(job_id)], queue="resumes")


async def dispatch_queued_resume_jobs_for_session(import_session_id) -> int:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ResumeProcessingJob.id)
            .where(
                ResumeProcessingJob.import_session_id == import_session_id,
                ResumeProcessingJob.status == ResumeJobStatus.QUEUED,
            )
            .order_by(ResumeProcessingJob.created_at.asc())
        )
        job_ids = result.scalars().all()

    for job_id in job_ids:
        dispatch_resume_job(job_id)
    return len(job_ids)


async def dispatch_stale_queued_resume_jobs(older_than_seconds: int = 30, limit: int = 100) -> int:
    cutoff = datetime.utcnow() - timedelta(seconds=older_than_seconds)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ResumeProcessingJob.id)
            .where(
                ResumeProcessingJob.status == ResumeJobStatus.QUEUED,
                ResumeProcessingJob.created_at <= cutoff,
            )
            .order_by(ResumeProcessingJob.created_at.asc())
            .limit(limit)
        )
        job_ids = result.scalars().all()

    for job_id in job_ids:
        dispatch_resume_job(job_id)
    return len(job_ids)


async def _process_resume_job(job_id: str) -> dict:
    async with AsyncSessionLocal() as db:
        job_uuid = UUID(job_id)
        job = await claim_resume_job_by_id(db, job_uuid)
        if not job:
            return {"job_id": job_id, "status": "skipped"}

        import_session_id = job.import_session_id
        processed = await process_resume_job(db, job)

    dispatched = await dispatch_queued_resume_jobs_for_session(import_session_id)
    return {
        "job_id": job_id,
        "status": processed.status.value,
        "dispatched_children": dispatched,
    }


@celery_app.task(
    name="app.tasks.resume.process_resume_job",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def process_resume_job_task(self, job_id: str) -> dict:
    del self
    return asyncio.run(_process_resume_job(job_id))


@celery_app.task(
    name="app.tasks.resume.dispatch_queued_resume_jobs",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def dispatch_queued_resume_jobs_task(self) -> dict:
    del self
    count = asyncio.run(dispatch_stale_queued_resume_jobs())
    logger.info("Dispatched %s queued resume jobs", count)
    return {"dispatched": count}
