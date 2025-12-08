from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.models.job import JobPosting, JobApplication
from app.models.user import User
from app.schemas.job import (
    JobCreate,
    JobRead,
    JobList,
    JobApplicationCreate,
    JobApplicationRead,
    MyApplicationsResponse,
)

router = APIRouter()


@router.get("", response_model=JobList)
async def list_jobs(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    query: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    active_only: bool = True,
) -> Any:
    stmt = select(JobPosting)
    if query:
        stmt = stmt.where(
            or_(
                JobPosting.title.ilike(f"%{query}%"),
                JobPosting.company.ilike(f"%{query}%"),
                JobPosting.description.ilike(f"%{query}%"),
            )
        )
    if location:
        stmt = stmt.where(JobPosting.location.ilike(f"%{location}%"))
    if job_type:
        stmt = stmt.where(JobPosting.job_type == job_type)
    if active_only:
        stmt = stmt.where(JobPosting.is_active.is_(True))

    total_result = await db.execute(stmt.with_only_columns(func.count()))
    total = total_result.scalar_one()

    pages = (total + limit - 1) // limit if total else 1
    stmt = stmt.order_by(JobPosting.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(stmt)
    jobs = result.scalars().all()

    jobs_with_counts = []
    for job in jobs:
        count_result = await db.execute(
            select(func.count()).select_from(JobApplication).where(JobApplication.job_id == job.id)
        )
        applications_count = count_result.scalar_one()
        job_dict = JobRead.from_orm(job).dict()
        job_dict["applications_count"] = applications_count
        jobs_with_counts.append(JobRead(**job_dict))

    return JobList(
        items=jobs_with_counts,
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
    job = JobPosting(**job_in.dict(), posted_by=current_user.id)
    db.add(job)
    await db.commit()
    await db.refresh(job)
    job_dict = JobRead.from_orm(job).dict()
    job_dict["applications_count"] = 0
    return JobRead(**job_dict)


@router.get("/{job_id}", response_model=JobRead)
async def get_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    count_result = await db.execute(
        select(func.count()).select_from(JobApplication).where(JobApplication.job_id == job.id)
    )
    applications_count = count_result.scalar_one()
    job_dict = JobRead.from_orm(job).dict()
    job_dict["applications_count"] = applications_count
    return JobRead(**job_dict)


@router.post("/{job_id}/apply", response_model=JobApplicationRead, status_code=status.HTTP_201_CREATED)
async def apply_to_job(
    job_id: str,
    application_in: JobApplicationCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
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
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)
    return application


@router.get("/applications/me", response_model=MyApplicationsResponse)
async def list_my_applications(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(
        select(JobApplication).where(JobApplication.applicant_id == current_user.id)
    )
    applications = result.scalars().all()
    return MyApplicationsResponse(items=applications)


