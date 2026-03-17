from typing import Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_, desc, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api import deps
from app.core.database import get_db
from app.models.job import Job, JobApplication, JobStatus, JobFormat, JobEmploymentType, ApplicationStatus
from app.models.user import User, UserRole
from app.schemas.job import (
    JobCreate,
    JobRead,
    JobUpdate,
    JobList,
    JobApplicationCreate,
    JobApplicationRead,
    JobApplicationUpdateStatus,
    MyApplicationsResponse,
)
from app.core import storage
# from app.services import email_service # Todo: Implement email service integration

router = APIRouter()

# --- Role Check Helpers ---
def can_moderate_jobs(user: Optional[User]) -> bool:
    if not user:
        return False
    system_roles = user.system_roles or []
    return user.is_admin or user.role == UserRole.STAFF or "JOB_MODERATOR" in system_roles

def check_is_poster(user: User):
    system_roles = user.system_roles or []
    if user.is_admin:
        return
    if user.role == UserRole.ALUMNI:
        return
    if "JOB_POSTER" in system_roles:
        return
    raise HTTPException(status_code=403, detail="Not authorized to post jobs")

def check_is_admin_or_moderator(user: User):
    if can_moderate_jobs(user):
        return
    raise HTTPException(status_code=403, detail="Not authorized to moderate jobs")

# --- Job Endpoints ---

@router.get("", response_model=JobList)
async def list_jobs(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    query: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    job_type: Optional[JobEmploymentType] = Query(None),
    employment_type: Optional[JobEmploymentType] = Query(None),
    format: Optional[JobFormat] = Query(None),
    company: Optional[str] = Query(None),
    status_filter: Optional[JobStatus] = Query(None, alias="status"),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """
    List jobs. By default lists only APPROVED jobs.
    Admins or Posters seeing their own might want other filters, but public list is Approved only.
    """
    stmt = select(Job)
    can_moderate = can_moderate_jobs(current_user)

    if can_moderate:
        if status_filter is not None:
            stmt = stmt.where(Job.status == status_filter)
        else:
            stmt = stmt.where(Job.status.in_([JobStatus.PENDING, JobStatus.APPROVED]))
    else:
        if status_filter not in (None, JobStatus.APPROVED):
            raise HTTPException(status_code=403, detail="Not authorized to view jobs with this status")
        stmt = stmt.where(Job.status == JobStatus.APPROVED)
    
    if query:
        stmt = stmt.where(
            or_(
                Job.title.ilike(f"%{query}%"),
                Job.company.ilike(f"%{query}%"),
                Job.description.ilike(f"%{query}%"),
            )
        )
    if location:
        stmt = stmt.where(Job.location.ilike(f"%{location}%"))
    effective_employment_type = employment_type or job_type
    if effective_employment_type:
        stmt = stmt.where(Job.employment_type == effective_employment_type)
    if format:
        stmt = stmt.where(Job.format == format)
    if company:
         stmt = stmt.where(Job.company.ilike(f"%{company}%"))

    # Count
    total_result = await db.execute(stmt.with_only_columns(func.count()))
    total = total_result.scalar_one()

    pages = (total + limit - 1) // limit if total else 1
    
    sort_timestamp = func.coalesce(Job.updated_at, Job.created_at)
    if can_moderate and status_filter is None:
        stmt = stmt.order_by(
            desc(case((Job.status == JobStatus.PENDING, 1), else_=0)),
            desc(sort_timestamp),
        )
    else:
        stmt = stmt.order_by(desc(sort_timestamp))

    stmt = stmt.offset((page - 1) * limit).limit(limit)
    
    result = await db.execute(stmt)
    jobs = result.scalars().all()

    # Enrich with application counts if needed (expensive in loop, better to join or separate query)
    # For list view we might not need count, or we cache it.
    # We will do a simple separate query for now for MVP.
    items = []
    for job in jobs:
        # Optimization: only count if user is owner or admin? 
        # Public users don't strictly need app count.
        # But let's return it for now.
        count_res = await db.execute(
             select(func.count()).select_from(JobApplication).where(JobApplication.job_id == job.id)
        )
        app_count = count_res.scalar_one()
        job_dict = JobRead.from_orm(job).dict()
        job_dict["applications_count"] = app_count
        items.append(JobRead(**job_dict))

    return JobList(
        items=items,
        total=total,
        pages=pages,
        page=page,
        limit=limit,
    )

@router.post("", response_model=JobRead, status_code=status.HTTP_201_CREATED)
async def create_job(
    job_in: JobCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    check_is_poster(current_user)
    
    job = Job(
        **job_in.dict(), 
        created_by=current_user.id,
        status=JobStatus.DRAFT # Always start as Draft
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job

@router.get("/{job_id}", response_model=JobRead)
async def get_job(
    job_id: str,
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Permission check: if not approved, only owner or admin can see
    if job.status != JobStatus.APPROVED:
        if not current_user:
            raise HTTPException(status_code=403, detail="Not authorized")
        if current_user.id != job.created_by and not can_moderate_jobs(current_user):
             raise HTTPException(status_code=403, detail="Job is not public")

    # Get count
    count_res = await db.execute(
             select(func.count()).select_from(JobApplication).where(JobApplication.job_id == job.id)
    )
    app_count = count_res.scalar_one()
    job_dict = JobRead.from_orm(job).dict()
    job_dict["applications_count"] = app_count
    return JobRead(**job_dict)

@router.put("/{job_id}", response_model=JobRead)
async def update_job(
    job_id: str,
    job_in: JobUpdate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if job.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to edit this job")
        
    update_data = job_in.dict(exclude_unset=True)
    if "status" in update_data:
        raise HTTPException(
            status_code=400,
            detail="Job status can only be changed via workflow endpoints",
        )

    for field, value in update_data.items():
        setattr(job, field, value)
    
    # If user changes essential fields, maybe reset to DRAFT?
    # For now, trust the user or let them explicitly change status via endpoint.
    
    await db.commit()
    await db.refresh(job)
    return job

@router.post("/{job_id}/submit", response_model=JobRead)
async def submit_job(
    job_id: str,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if job.status != JobStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only draft jobs can be submitted")

    job.status = JobStatus.PENDING
    await db.commit()
    await db.refresh(job)
    # Todo: Notify moderators
    return job

@router.post("/{job_id}/approve", response_model=JobRead)
async def approve_job(
    job_id: str,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    check_is_admin_or_moderator(current_user)
    
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalars().first()
    if not job:
         raise HTTPException(status_code=404, detail="Job not found")
    if job.status != JobStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending jobs can be approved")
         
    job.status = JobStatus.APPROVED
    job.approved_by = current_user.id
    await db.commit()
    await db.refresh(job)
    # Todo: Notify creator
    return job

@router.post("/{job_id}/reject", response_model=JobRead)
async def reject_job(
    job_id: str,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    check_is_admin_or_moderator(current_user)
    
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalars().first()
    if not job:
         raise HTTPException(status_code=404, detail="Job not found")
    if job.status != JobStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending jobs can be rejected")
         
    job.status = JobStatus.DRAFT # Or REJECTED? Spec says "reject -> status = draft"
    await db.commit()
    await db.refresh(job)
    # Todo: Notify creator
    return job

@router.post("/{job_id}/close", response_model=JobRead)
async def close_job(
    job_id: str,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalars().first()
    if not job:
         raise HTTPException(status_code=404, detail="Job not found")
    
    if job.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    if job.status != JobStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Only approved jobs can be closed")
        
    job.status = JobStatus.CLOSED
    await db.commit()
    await db.refresh(job)
    return job

# --- Application Endpoints ---

@router.post("/presigned-url")
async def get_upload_url(
    filename: str,
    filetype: str,
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Get a presigned URL to upload resume to MinIO directly.
    """
    return storage.generate_presigned_url(filename, filetype)

@router.post("/{job_id}/apply", response_model=JobApplicationRead, status_code=status.HTTP_201_CREATED)
async def apply_to_job(
    job_id: str,
    application_in: JobApplicationCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    # Check if job exists and is approved
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != JobStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Cannot apply to a job that is not approved")
        
    # Check duplicate
    existing = await db.execute(
        select(JobApplication).where(
            JobApplication.job_id == job_id,
            JobApplication.applicant_id == current_user.id,
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="You already applied to this job")

    application = JobApplication(
        job_id=job_id,
        applicant_id=current_user.id,
        resume_url=application_in.resume_url,
        cover_letter=application_in.cover_letter,
        status=ApplicationStatus.SUBMITTED
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)
    # Todo: Notify poster
    return application

@router.get("/{job_id}/applications", response_model=List[JobApplicationRead])
async def list_job_applications(
    job_id: str,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    # Only poster or admin
    job_res = await db.execute(select(Job).where(Job.id == job_id))
    job = job_res.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if job.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    result = await db.execute(
        select(JobApplication).where(JobApplication.job_id == job_id).order_by(JobApplication.applied_at.desc())
    )
    return result.scalars().all()

@router.patch("/applications/{application_id}/status", response_model=JobApplicationRead)
async def update_application_status(
    application_id: str,
    status_update: JobApplicationUpdateStatus,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(select(JobApplication).options(selectinload(JobApplication.job)).where(JobApplication.id == application_id))
    application = result.scalars().first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
        
    # Check permission (Job Poster)
    job = application.job
    if job.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    application.status = status_update.status
    await db.commit()
    await db.refresh(application)
    # Todo: Notify applicant
    return application

@router.get("/applications/me", response_model=MyApplicationsResponse)
async def list_my_applications(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(
        select(JobApplication).where(JobApplication.applicant_id == current_user.id).order_by(JobApplication.applied_at.desc())
    )
    applications = result.scalars().all()
    return MyApplicationsResponse(items=applications)
