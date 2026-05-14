from typing import Any, List
from datetime import datetime, timezone
import uuid
from uuid import UUID
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api import deps
from app.core.database import get_db
from app.models.user import User, UserProfile
from app.models.mentorship import (
    MentorFeedback,
    MentorshipPlan,
    MentorshipRelationship,
    MentorshipRelationshipStatus,
    MentorshipRequest,
    MentorshipSession,
    MentorshipSessionStatus,
    MentorshipStatus,
)
from app.schemas.mentorship import (
    MentorshipMilestoneToggle,
    MentorshipPlanRead,
    MentorshipPlanUpsert,
    MentorshipRequestDecline,
    MentorshipRequestCreate,
    MentorshipRequestRead,
    MentorshipRelationshipRead,
    MentorshipRelationshipStatusUpdate,
    MentorshipSessionCreate,
    MentorshipSessionRead,
    MentorshipSessionUpdate,
    BecomeMentorRequest,
    MentorFeedbackCreate,
    MentorFeedbackRead,
    normalize_milestones,
)
from app.api.v1.endpoints.profile import get_profile_data
from app.schemas.profile import ProfileRead
from app.core.cache import invalidate_namespaces
from app.services import notification as notification_service

router = APIRouter()
logger = logging.getLogger(__name__)


def _to_naive_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


async def _profile_for_user(db: AsyncSession, user_id: UUID) -> ProfileRead | None:
    stmt = select(User).options(selectinload(User.profile)).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()
    if not user:
        return None
    return await get_profile_data(user, db)


async def _mentor_active_count(db: AsyncSession, mentor_id: UUID) -> int:
    count = await db.scalar(
        select(func.count(MentorshipRelationship.id)).where(
            MentorshipRelationship.mentor_id == mentor_id,
            MentorshipRelationship.status == MentorshipRelationshipStatus.ACTIVE,
        )
    )
    return int(count or 0)


async def _ensure_mentor_has_capacity(db: AsyncSession, mentor: User) -> None:
    stmt = select(User).options(selectinload(User.profile)).where(User.id == mentor.id)
    result = await db.execute(stmt)
    mentor = result.scalars().first()
    max_mentees = mentor.profile.mentor_max_mentees if mentor and mentor.profile else None
    if not max_mentees or max_mentees <= 0:
        return
    active_count = await _mentor_active_count(db, mentor.id)
    if active_count >= max_mentees:
        raise HTTPException(status_code=409, detail="This mentor has reached their active mentee capacity")


def _request_goal_text(request: MentorshipRequest) -> str | None:
    goals = request.goals or []
    goal_line = ", ".join(goals) if goals else ""
    message = (request.message or "").strip()
    if goal_line and message:
        return f"{goal_line}\n\n{message}"
    return goal_line or message or None


def _milestones_from_goals(goals: list[str] | None) -> list[dict[str, Any]]:
    return [
        {
            "id": str(uuid.uuid4()),
            "title": str(goal).strip(),
            "completed": False,
            "completed_at": None,
        }
        for goal in (goals or [])
        if str(goal).strip()
    ]


def _milestones_for_storage(value: Any) -> list[dict[str, Any]]:
    milestones = normalize_milestones(value)
    for milestone in milestones:
        completed_at = milestone.get("completed_at")
        if isinstance(completed_at, datetime):
            milestone["completed_at"] = completed_at.isoformat()
    return milestones


async def _populate_request(db: AsyncSession, request: MentorshipRequest) -> MentorshipRequestRead:
    item = MentorshipRequestRead.model_validate(request)
    item.sender = await _profile_for_user(db, request.sender_id)
    item.receiver = await _profile_for_user(db, request.receiver_id)
    return item


async def _get_relationship_for_participant(
    db: AsyncSession,
    relationship_id: UUID,
    current_user: User,
) -> MentorshipRelationship:
    stmt = (
        select(MentorshipRelationship)
        .options(
            selectinload(MentorshipRelationship.plan),
            selectinload(MentorshipRelationship.sessions),
        )
        .where(MentorshipRelationship.id == relationship_id)
    )
    result = await db.execute(stmt)
    relationship = result.scalars().first()
    if not relationship:
        raise HTTPException(status_code=404, detail="Relationship not found")
    if current_user.id not in (relationship.mentor_id, relationship.mentee_id):
        raise HTTPException(status_code=403, detail="Not a participant of this relationship")
    return relationship


async def _populate_relationship(db: AsyncSession, relationship: MentorshipRelationship) -> MentorshipRelationshipRead:
    item = MentorshipRelationshipRead.model_validate(relationship)
    item.mentor = await _profile_for_user(db, relationship.mentor_id)
    item.mentee = await _profile_for_user(db, relationship.mentee_id)
    if item.sessions:
        item.sessions = sorted(item.sessions, key=lambda session: session.scheduled_at or session.created_at)
    return item

@router.post("/become", response_model=ProfileRead)
async def become_mentor(
    payload: BecomeMentorRequest,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Allow any active user to opt into mentor capabilities.
    """
    if not payload.consent_mentor:
        raise HTTPException(status_code=400, detail="Consent is required to become a mentor.")

    # Ensure profile exists
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == current_user.id)
    )
    user = result.scalars().first()
    if user.profile is None:
        user.profile = UserProfile(user_id=user.id)

    user.is_mentor = True
    user.profile.mentor_consent = True
    user.profile.mentor_headline = payload.headline
    user.profile.mentor_areas_of_help = payload.areas_of_help or []
    user.profile.mentor_industries = payload.industries or []
    user.profile.mentor_max_mentees = payload.max_mentees
    user.profile.mentor_availability_note = payload.availability_note
    user.profile.mentor_availability_slots = [
        slot.model_dump(mode="json") for slot in (payload.availability_slots or [])
    ]

    db.add(user)
    db.add(user.profile)
    await db.commit()
    await db.refresh(user)
    await invalidate_namespaces("profile", "directory", "recommendations")

    return await get_profile_data(user, db)

@router.post("/request", response_model=MentorshipRequestRead)
async def send_mentorship_request(
    request_in: MentorshipRequestCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Send a mentorship request.
    """
    if request_in.receiver_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot request mentorship from yourself")

    # Ensure receiver is a mentor
    receiver_result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == request_in.receiver_id)
    )
    receiver = receiver_result.scalars().first()
    if not receiver or not receiver.is_active or not receiver.is_mentor:
        raise HTTPException(status_code=400, detail="Selected user is not available as a mentor")
    await _ensure_mentor_has_capacity(db, receiver)

    # Check if request already exists (PENDING)
    stmt = select(MentorshipRequest).where(
        MentorshipRequest.sender_id == current_user.id,
        MentorshipRequest.receiver_id == request_in.receiver_id,
        MentorshipRequest.status == MentorshipStatus.PENDING
    )
    result = await db.execute(stmt)
    existing_request = result.scalars().first()
    if existing_request:
        raise HTTPException(status_code=400, detail="Pending request already exists")

    # Check if relationship already exists
    stmt = select(MentorshipRelationship).where(
        or_(
            and_(MentorshipRelationship.mentor_id == request_in.receiver_id, MentorshipRelationship.mentee_id == current_user.id),
            and_(MentorshipRelationship.mentor_id == current_user.id, MentorshipRelationship.mentee_id == request_in.receiver_id)
        ),
        MentorshipRelationship.status == MentorshipRelationshipStatus.ACTIVE,
    )
    result = await db.execute(stmt)
    existing_rel = result.scalars().first()
    if existing_rel:
        raise HTTPException(status_code=400, detail="Mentorship relationship already exists")

    request = MentorshipRequest(
        sender_id=current_user.id,
        receiver_id=request_in.receiver_id,
        message=request_in.message,
        goals=request_in.goals or [],
        expected_duration=request_in.expected_duration,
        preferred_format=request_in.preferred_format,
        meeting_frequency=request_in.meeting_frequency,
        status=MentorshipStatus.PENDING
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)
    
    # Create notification for the mentor
    await notification_service.create_mentorship_request_notification(
        db=db,
        mentor_id=request.receiver_id,
        requester=current_user,
        request_id=request.id,
    )
    
    return await _populate_request(db, request)

@router.get("/requests/incoming", response_model=List[MentorshipRequestRead])
async def get_incoming_requests(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    if not current_user.is_mentor:
        raise HTTPException(status_code=403, detail="Only mentors can view incoming requests")

    stmt = select(MentorshipRequest).where(
        MentorshipRequest.receiver_id == current_user.id,
        MentorshipRequest.status == MentorshipStatus.PENDING
    ).order_by(MentorshipRequest.created_at.desc())
    
    result = await db.execute(stmt)
    requests = result.scalars().all()
    
    response_items = []
    for req in requests:
        response_items.append(await _populate_request(db, req))
        
    return response_items

@router.get("/requests/outgoing", response_model=List[MentorshipRequestRead])
async def get_outgoing_requests(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    stmt = select(MentorshipRequest).where(
        MentorshipRequest.sender_id == current_user.id
    ).order_by(MentorshipRequest.created_at.desc())
    
    result = await db.execute(stmt)
    requests = result.scalars().all()
    
    response_items = []
    for req in requests:
        response_items.append(await _populate_request(db, req))
        
    return response_items

@router.put("/requests/{request_id}/accept", response_model=MentorshipRequestRead)
async def accept_request(
    request_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    stmt = select(MentorshipRequest).where(MentorshipRequest.id == request_id)
    result = await db.execute(stmt)
    request = result.scalars().first()
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if request.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if request.status != MentorshipStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request is not pending")

    if not current_user.is_mentor:
        raise HTTPException(status_code=403, detail="Only mentors can accept requests")
    await _ensure_mentor_has_capacity(db, current_user)

    existing_stmt = select(MentorshipRelationship).where(
        MentorshipRelationship.mentor_id == current_user.id,
        MentorshipRelationship.mentee_id == request.sender_id,
        MentorshipRelationship.status == MentorshipRelationshipStatus.ACTIVE,
    )
    existing_result = await db.execute(existing_stmt)
    if existing_result.scalars().first():
        raise HTTPException(status_code=400, detail="Active mentorship relationship already exists")

    request.status = MentorshipStatus.ACCEPTED
    request.updated_at = datetime.utcnow()

    relationship = MentorshipRelationship(
        mentor_id=current_user.id,
        mentee_id=request.sender_id,
        request_id=request.id,
        status=MentorshipRelationshipStatus.ACTIVE,
        goals=_request_goal_text(request),
        expected_duration=request.expected_duration,
        preferred_format=request.preferred_format,
    )
    db.add(relationship)
    db.add(request)
    await db.commit()
    await db.refresh(request)
    await db.refresh(relationship)

    plan = MentorshipPlan(
        relationship_id=relationship.id,
        goal=_request_goal_text(request),
        milestones=_milestones_from_goals(request.goals),
        expected_duration=request.expected_duration,
        meeting_frequency=request.meeting_frequency or "To be agreed",
        next_step="Schedule the first mentorship session.",
    )
    db.add(plan)
    await db.commit()
    
    # Create notification for the mentee
    await notification_service.create_mentorship_accepted_notification(
        db=db,
        mentee_id=request.sender_id,
        mentor=current_user,
        relationship_id=relationship.id,
    )
    
    return await _populate_request(db, request)

@router.put("/requests/{request_id}/decline", response_model=MentorshipRequestRead)
async def decline_request(
    request_id: UUID,
    decline_in: MentorshipRequestDecline | None = None,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    stmt = select(MentorshipRequest).where(MentorshipRequest.id == request_id)
    result = await db.execute(stmt)
    request = result.scalars().first()
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if request.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if request.status != MentorshipStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request is not pending")

    if not current_user.is_mentor:
        raise HTTPException(status_code=403, detail="Only mentors can decline requests")

    request.status = MentorshipStatus.DECLINED
    request.decline_reason = decline_in.reason if decline_in else None
    request.updated_at = datetime.utcnow()
    db.add(request)
    await db.commit()
    await db.refresh(request)

    return await _populate_request(db, request)

@router.put("/requests/{request_id}/cancel", response_model=MentorshipRequestRead)
async def cancel_request(
    request_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Cancel an outgoing mentorship request (only by the sender)."""
    stmt = select(MentorshipRequest).where(MentorshipRequest.id == request_id)
    result = await db.execute(stmt)
    request = result.scalars().first()
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if request.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized - only the sender can cancel")
        
    if request.status != MentorshipStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request is not pending")
        
    request.status = MentorshipStatus.CANCELLED
    request.updated_at = datetime.utcnow()
    db.add(request)
    await db.commit()
    await db.refresh(request)

    return await _populate_request(db, request)

@router.post("/relationships/{relationship_id}/feedback", response_model=MentorFeedbackRead)
async def submit_feedback(
    relationship_id: UUID,
    feedback_in: MentorFeedbackCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Mentor submits a 5-star rating with comment for their mentee."""
    stmt = select(MentorshipRelationship).where(MentorshipRelationship.id == relationship_id)
    result = await db.execute(stmt)
    rel = result.scalars().first()

    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    if rel.mentor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the mentor can submit feedback")

    # Check if feedback already exists for this relationship
    existing_stmt = select(MentorFeedback).where(
        MentorFeedback.relationship_id == rel.id,
        MentorFeedback.mentor_id == current_user.id,
    )
    existing_result = await db.execute(existing_stmt)
    existing = existing_result.scalars().first()

    if existing:
        # Update existing feedback
        existing.rating = feedback_in.rating
        existing.comment = feedback_in.comment
        existing.updated_at = datetime.utcnow()
        db.add(existing)
        await db.commit()
        await db.refresh(existing)
        feedback = existing
    else:
        feedback = MentorFeedback(
            mentor_id=current_user.id,
            mentee_id=rel.mentee_id,
            relationship_id=rel.id,
            rating=feedback_in.rating,
            comment=feedback_in.comment,
        )
        db.add(feedback)
        await db.commit()
        await db.refresh(feedback)

        try:
            await notification_service.create_mentor_feedback_notification(
                db=db,
                mentee_id=rel.mentee_id,
                mentor=current_user,
                feedback_id=feedback.id,
                rating=feedback_in.rating,
            )
        except Exception:
            # Feedback is already saved; do not fail the request if notification write fails.
            await db.rollback()
            logger.exception(
                "Failed to create mentor feedback notification for feedback_id=%s",
                feedback.id,
            )

    item = MentorFeedbackRead.model_validate(feedback)
    # Populate mentor profile
    mentor_user_stmt = select(User).options(selectinload(User.profile)).where(User.id == feedback.mentor_id)
    mentor_result = await db.execute(mentor_user_stmt)
    mentor_user = mentor_result.scalars().first()
    if mentor_user:
        item.mentor = await get_profile_data(mentor_user, db)
    return item


@router.get("/relationships/{relationship_id}/feedback", response_model=MentorFeedbackRead)
async def get_feedback(
    relationship_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get feedback for a specific mentorship relationship."""
    stmt = select(MentorshipRelationship).where(MentorshipRelationship.id == relationship_id)
    result = await db.execute(stmt)
    rel = result.scalars().first()

    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    if current_user.id not in (rel.mentor_id, rel.mentee_id):
        raise HTTPException(status_code=403, detail="Not a participant of this relationship")

    feedback_stmt = select(MentorFeedback).where(MentorFeedback.relationship_id == rel.id)
    feedback_result = await db.execute(feedback_stmt)
    feedback = feedback_result.scalars().first()

    if not feedback:
        raise HTTPException(status_code=404, detail="No feedback yet for this relationship")

    item = MentorFeedbackRead.model_validate(feedback)
    mentor_user_stmt = select(User).options(selectinload(User.profile)).where(User.id == feedback.mentor_id)
    mentor_result = await db.execute(mentor_user_stmt)
    mentor_user = mentor_result.scalars().first()
    if mentor_user:
        item.mentor = await get_profile_data(mentor_user, db)
    return item


@router.get("/feedback/received", response_model=List[MentorFeedbackRead])
async def get_received_feedback(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get all feedback received by the current user as a mentee."""
    stmt = select(MentorFeedback).where(MentorFeedback.mentee_id == current_user.id).order_by(MentorFeedback.created_at.desc())
    result = await db.execute(stmt)
    feedbacks = result.scalars().all()

    items = []
    for fb in feedbacks:
        item = MentorFeedbackRead.model_validate(fb)
        mentor_user_stmt = select(User).options(selectinload(User.profile)).where(User.id == fb.mentor_id)
        mentor_result = await db.execute(mentor_user_stmt)
        mentor_user = mentor_result.scalars().first()
        if mentor_user:
            item.mentor = await get_profile_data(mentor_user, db)
        items.append(item)
    return items


@router.get("/relationships", response_model=List[MentorshipRelationshipRead])
async def get_relationships(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    stmt = (
        select(MentorshipRelationship)
        .options(
            selectinload(MentorshipRelationship.plan),
            selectinload(MentorshipRelationship.sessions),
        )
        .where(
            or_(
                MentorshipRelationship.mentor_id == current_user.id,
                MentorshipRelationship.mentee_id == current_user.id
            )
        )
        .order_by(MentorshipRelationship.created_at.desc())
    )
    result = await db.execute(stmt)
    rels = result.scalars().all()

    return [await _populate_relationship(db, rel) for rel in rels]


@router.patch("/relationships/{relationship_id}/status", response_model=MentorshipRelationshipRead)
async def update_relationship_status(
    relationship_id: UUID,
    status_in: MentorshipRelationshipStatusUpdate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    relationship = await _get_relationship_for_participant(db, relationship_id, current_user)
    if current_user.id != relationship.mentor_id:
        raise HTTPException(status_code=403, detail="Only the mentor can update mentorship status")
    relationship.status = status_in.status
    relationship.updated_at = datetime.utcnow()
    db.add(relationship)
    await db.commit()
    await db.refresh(relationship)
    relationship = await _get_relationship_for_participant(db, relationship_id, current_user)
    return await _populate_relationship(db, relationship)


@router.get("/relationships/{relationship_id}/plan", response_model=MentorshipPlanRead)
async def get_plan(
    relationship_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    relationship = await _get_relationship_for_participant(db, relationship_id, current_user)
    if not relationship.plan:
        raise HTTPException(status_code=404, detail="Mentorship plan not found")
    return MentorshipPlanRead.model_validate(relationship.plan)


@router.put("/relationships/{relationship_id}/plan", response_model=MentorshipPlanRead)
async def upsert_plan(
    relationship_id: UUID,
    plan_in: MentorshipPlanUpsert,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    relationship = await _get_relationship_for_participant(db, relationship_id, current_user)
    if current_user.id != relationship.mentor_id:
        raise HTTPException(status_code=403, detail="Only the mentor can update the mentorship plan")

    plan = relationship.plan
    if not plan:
        plan = MentorshipPlan(relationship_id=relationship.id)

    plan.goal = plan_in.goal
    plan.milestones = _milestones_for_storage(plan_in.milestones)
    plan.meeting_frequency = plan_in.meeting_frequency
    plan.expected_duration = plan_in.expected_duration
    plan.notes = plan_in.notes
    plan.next_step = plan_in.next_step
    plan.updated_at = datetime.utcnow()

    relationship.goals = plan_in.goal or relationship.goals
    relationship.expected_duration = plan_in.expected_duration or relationship.expected_duration
    relationship.updated_at = datetime.utcnow()

    db.add(plan)
    db.add(relationship)
    await db.commit()
    await db.refresh(plan)
    return MentorshipPlanRead.model_validate(plan)


@router.patch("/relationships/{relationship_id}/plan/milestones/{milestone_id}", response_model=MentorshipPlanRead)
async def toggle_milestone(
    relationship_id: UUID,
    milestone_id: str,
    milestone_in: MentorshipMilestoneToggle,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    relationship = await _get_relationship_for_participant(db, relationship_id, current_user)
    if not relationship.plan:
        raise HTTPException(status_code=404, detail="Mentorship plan not found")

    milestones = _milestones_for_storage(relationship.plan.milestones or [])
    target = next((item for item in milestones if item["id"] == milestone_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Milestone not found")

    target["completed"] = milestone_in.completed
    target["completed_at"] = datetime.utcnow().isoformat() if milestone_in.completed else None
    relationship.plan.milestones = milestones
    relationship.plan.updated_at = datetime.utcnow()
    db.add(relationship.plan)
    await db.commit()
    await db.refresh(relationship.plan)
    return MentorshipPlanRead.model_validate(relationship.plan)


@router.get("/relationships/{relationship_id}/sessions", response_model=List[MentorshipSessionRead])
async def get_sessions(
    relationship_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    relationship = await _get_relationship_for_participant(db, relationship_id, current_user)
    sessions = sorted(relationship.sessions, key=lambda item: item.scheduled_at or item.created_at)
    return [MentorshipSessionRead.model_validate(item) for item in sessions]


@router.post("/relationships/{relationship_id}/sessions", response_model=MentorshipSessionRead)
async def create_session(
    relationship_id: UUID,
    session_in: MentorshipSessionCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    relationship = await _get_relationship_for_participant(db, relationship_id, current_user)
    if relationship.status != MentorshipRelationshipStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Sessions can only be created for active mentorships")

    session = MentorshipSession(
        relationship_id=relationship.id,
        created_by_id=current_user.id,
        topic=session_in.topic,
        scheduled_at=_to_naive_utc(session_in.scheduled_at),
        notes=session_in.notes,
        status=MentorshipSessionStatus.PLANNED,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    session.room_name = f"platform-mentorship-session-{session.id}"
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return MentorshipSessionRead.model_validate(session)


@router.patch("/sessions/{session_id}", response_model=MentorshipSessionRead)
async def update_session(
    session_id: UUID,
    session_in: MentorshipSessionUpdate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = select(MentorshipSession).where(MentorshipSession.id == session_id)
    result = await db.execute(stmt)
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    await _get_relationship_for_participant(db, session.relationship_id, current_user)

    if session_in.topic is not None:
        session.topic = session_in.topic
    if session_in.scheduled_at is not None:
        session.scheduled_at = _to_naive_utc(session_in.scheduled_at)
    if session_in.status is not None:
        session.status = session_in.status
    if session_in.notes is not None:
        session.notes = session_in.notes
    session.updated_at = datetime.utcnow()

    db.add(session)
    await db.commit()
    await db.refresh(session)
    return MentorshipSessionRead.model_validate(session)
