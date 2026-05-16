from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api import deps
from app.core.database import get_db
from app.models.project import Project, ProjectApplication, ProjectCategory, ProjectRole, ProjectStage
from app.models.user import User, UserProfile
from app.schemas.project import (
    ProjectApplicationCreate,
    ProjectApplicationRead,
    ProjectCreate,
    ProjectList,
    ProjectRead,
    ProjectUpdate,
    SuggestedCandidateRead,
    UserProjectsRead,
)
from app.services.project_matching import calculate_match_score, matched_skills

router = APIRouter()


def _user_skills(user: Optional[User]) -> list[str]:
    if not user or not user.profile:
        return []
    return user.profile.skills or []


def _project_payload(
    project: Project,
    user: Optional[User],
    applications_count: int = 0,
    has_applied: bool = False,
) -> ProjectRead:
    data = ProjectRead.model_validate(project).model_dump()
    skills = _user_skills(user)
    data["applications_count"] = applications_count
    data["match_score"] = calculate_match_score(skills, project.required_skills)
    data["matched_skills"] = matched_skills(skills, project.required_skills)
    data["has_applied"] = has_applied
    return ProjectRead(**data)


async def _application_count_map(db: AsyncSession, project_ids: list[UUID]) -> dict[UUID, int]:
    if not project_ids:
        return {}
    result = await db.execute(
        select(ProjectApplication.project_id, func.count(ProjectApplication.id))
        .where(ProjectApplication.project_id.in_(project_ids))
        .group_by(ProjectApplication.project_id)
    )
    return {project_id: count for project_id, count in result.all()}


async def _applied_project_ids(db: AsyncSession, project_ids: list[UUID], user: Optional[User]) -> set[UUID]:
    if not project_ids or not user:
        return set()
    result = await db.execute(
        select(ProjectApplication.project_id).where(
            ProjectApplication.project_id.in_(project_ids),
            ProjectApplication.applicant_id == user.id,
        )
    )
    return set(result.scalars().all())


async def _get_project(db: AsyncSession, project_id: UUID) -> Project:
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.creator).selectinload(User.profile))
        .where(Project.id == project_id)
    )
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _ensure_owner(project: Project, user: User) -> None:
    if project.created_by_user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to manage this project")


def _serialize_url(value):
    return str(value) if value is not None else None


def _project_data(payload: ProjectCreate | ProjectUpdate, exclude_unset: bool = False) -> dict[str, Any]:
    data = payload.model_dump(exclude_unset=exclude_unset)
    if "github_link" in data:
        data["github_link"] = _serialize_url(data["github_link"])
    if "demo_link" in data:
        data["demo_link"] = _serialize_url(data["demo_link"])
    if "required_roles" in data and data["required_roles"] is not None:
        data["required_roles"] = [role.value if hasattr(role, "value") else role for role in data["required_roles"]]
    return data


@router.get("/recommended", response_model=ProjectList)
async def recommended_projects(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(8, ge=1, le=30),
) -> Any:
    stmt = (
        select(Project)
        .options(selectinload(Project.creator))
        .where(Project.created_by_user_id != current_user.id)
        .order_by(desc(Project.created_at))
        .limit(100)
    )
    result = await db.execute(stmt)
    projects = result.scalars().all()
    project_ids = [project.id for project in projects]
    counts = await _application_count_map(db, project_ids)
    applied_ids = await _applied_project_ids(db, project_ids, current_user)
    ranked = sorted(
        [
            _project_payload(project, current_user, counts.get(project.id, 0), project.id in applied_ids)
            for project in projects
        ],
        key=lambda item: (item.match_score, item.created_at),
        reverse=True,
    )[:limit]
    return ProjectList(items=ranked, total=len(ranked), pages=1, page=1, limit=limit)


@router.get("/user/{user_id}", response_model=UserProjectsRead)
async def user_projects(
    user_id: UUID,
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> Any:
    created_result = await db.execute(
        select(Project)
        .options(selectinload(Project.creator))
        .where(Project.created_by_user_id == user_id)
        .order_by(desc(Project.created_at))
    )
    joined_result = await db.execute(
        select(Project)
        .join(ProjectApplication, ProjectApplication.project_id == Project.id)
        .options(selectinload(Project.creator))
        .where(ProjectApplication.applicant_id == user_id)
        .order_by(desc(ProjectApplication.applied_at))
    )
    created_projects = created_result.scalars().all()
    joined_projects = joined_result.scalars().all()
    projects = created_projects + joined_projects
    project_ids = [project.id for project in projects]
    counts = await _application_count_map(db, project_ids)
    applied_ids = await _applied_project_ids(db, project_ids, current_user)
    return UserProjectsRead(
        created_projects=[
            _project_payload(project, current_user, counts.get(project.id, 0), project.id in applied_ids)
            for project in created_projects
        ],
        joined_projects=[
            _project_payload(project, current_user, counts.get(project.id, 0), project.id in applied_ids)
            for project in joined_projects
        ],
    )


@router.get("", response_model=ProjectList)
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=50),
    query: Optional[str] = Query(None),
    category: Optional[ProjectCategory] = Query(None),
    required_role: Optional[ProjectRole] = Query(None),
    skills: Optional[str] = Query(None),
    remote_only: bool = Query(False),
    startup_only: bool = Query(False),
    university_only: bool = Query(False),
    sort: str = Query("latest", pattern="^(latest|match|popular)$"),
) -> Any:
    stmt = select(Project).options(selectinload(Project.creator))
    count_stmt = select(func.count()).select_from(Project)
    conditions = []

    if query:
        like = f"%{query}%"
        conditions.append(
            or_(
                Project.title.ilike(like),
                Project.short_description.ilike(like),
                Project.full_description.ilike(like),
            )
        )
    if category:
        conditions.append(Project.category == category)
    if required_role:
        conditions.append(Project.required_roles.any(required_role.value))
    if skills:
        for skill in [item.strip() for item in skills.split(",") if item.strip()]:
            conditions.append(Project.required_skills.any(skill))
    if remote_only:
        conditions.append(Project.is_remote.is_(True))
    if startup_only:
        conditions.append(Project.startup_idea.is_(True))
    if university_only:
        conditions.append(Project.university_related.is_(True))

    if conditions:
        criteria = and_(*conditions)
        stmt = stmt.where(criteria)
        count_stmt = count_stmt.where(criteria)

    total = await db.scalar(count_stmt)
    total = int(total or 0)
    pages = (total + limit - 1) // limit if total else 1

    if sort == "popular":
        app_count = (
            select(ProjectApplication.project_id, func.count(ProjectApplication.id).label("application_count"))
            .group_by(ProjectApplication.project_id)
            .subquery()
        )
        stmt = stmt.outerjoin(app_count, app_count.c.project_id == Project.id).order_by(
            desc(func.coalesce(app_count.c.application_count, 0)),
            desc(Project.created_at),
        )
    else:
        stmt = stmt.order_by(desc(Project.created_at))

    stmt = stmt.offset((page - 1) * limit).limit(limit)
    result = await db.execute(stmt)
    projects = result.scalars().all()
    project_ids = [project.id for project in projects]
    counts = await _application_count_map(db, project_ids)
    applied_ids = await _applied_project_ids(db, project_ids, current_user)
    items = [
        _project_payload(project, current_user, counts.get(project.id, 0), project.id in applied_ids)
        for project in projects
    ]
    if sort == "match" and current_user:
        items = sorted(items, key=lambda item: (item.match_score, item.created_at), reverse=True)

    return ProjectList(items=items, total=total, pages=pages, page=page, limit=limit)


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_in: ProjectCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    project = Project(**_project_data(project_in), created_by_user_id=current_user.id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    project = await _get_project(db, project.id)
    return _project_payload(project, current_user)


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: UUID,
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> Any:
    project = await _get_project(db, project_id)
    counts = await _application_count_map(db, [project.id])
    applied_ids = await _applied_project_ids(db, [project.id], current_user)
    return _project_payload(project, current_user, counts.get(project.id, 0), project.id in applied_ids)


@router.put("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: UUID,
    project_in: ProjectUpdate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    project = await _get_project(db, project_id)
    _ensure_owner(project, current_user)
    for field, value in _project_data(project_in, exclude_unset=True).items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    project = await _get_project(db, project.id)
    counts = await _application_count_map(db, [project.id])
    applied_ids = await _applied_project_ids(db, [project.id], current_user)
    return _project_payload(project, current_user, counts.get(project.id, 0), project.id in applied_ids)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    project = await _get_project(db, project_id)
    _ensure_owner(project, current_user)
    await db.delete(project)
    await db.commit()


@router.post("/{project_id}/apply", response_model=ProjectApplicationRead, status_code=status.HTTP_201_CREATED)
async def apply_to_project(
    project_id: UUID,
    application_in: ProjectApplicationCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    project = await _get_project(db, project_id)
    if project.created_by_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot apply to your own project")

    existing = await db.scalar(
        select(ProjectApplication.id).where(
            ProjectApplication.project_id == project_id,
            ProjectApplication.applicant_id == current_user.id,
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="You already applied to this project")

    application = ProjectApplication(
        project_id=project_id,
        applicant_id=current_user.id,
        message=application_in.message,
        skills=application_in.skills,
        fit_reason=application_in.fit_reason,
    )
    db.add(application)
    await db.commit()
    result = await db.execute(
        select(ProjectApplication)
        .options(
            selectinload(ProjectApplication.applicant),
            selectinload(ProjectApplication.project).selectinload(Project.creator),
        )
        .where(ProjectApplication.id == application.id)
    )
    application = result.scalars().first()
    data = ProjectApplicationRead.model_validate(application).model_dump()
    data["match_score"] = calculate_match_score(application.skills or _user_skills(current_user), project.required_skills)
    return ProjectApplicationRead(**data)


@router.get("/{project_id}/applications", response_model=list[ProjectApplicationRead])
async def list_project_applications(
    project_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    project = await _get_project(db, project_id)
    _ensure_owner(project, current_user)
    result = await db.execute(
        select(ProjectApplication)
        .options(
            selectinload(ProjectApplication.applicant).selectinload(User.profile),
            selectinload(ProjectApplication.project).selectinload(Project.creator),
        )
        .where(ProjectApplication.project_id == project_id)
        .order_by(desc(ProjectApplication.applied_at))
    )
    applications = result.scalars().all()
    items = []
    for application in applications:
        data = ProjectApplicationRead.model_validate(application).model_dump()
        data["match_score"] = calculate_match_score(application.skills or _user_skills(application.applicant), project.required_skills)
        items.append(ProjectApplicationRead(**data))
    return items


@router.get("/{project_id}/candidates", response_model=list[SuggestedCandidateRead])
async def suggested_candidates(
    project_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(8, ge=1, le=30),
) -> Any:
    project = await _get_project(db, project_id)
    _ensure_owner(project, current_user)
    result = await db.execute(
        select(User)
        .join(UserProfile, UserProfile.user_id == User.id)
        .options(selectinload(User.profile))
        .where(User.id != current_user.id, UserProfile.skills.is_not(None))
        .limit(200)
    )
    candidates = []
    for user in result.scalars().all():
        skills = user.profile.skills or []
        score = calculate_match_score(skills, project.required_skills)
        if score <= 0:
            continue
        candidates.append(
            SuggestedCandidateRead(
                user=user,
                skills=skills,
                match_score=score,
                matched_skills=matched_skills(skills, project.required_skills),
            )
        )
    return sorted(candidates, key=lambda item: item.match_score, reverse=True)[:limit]
