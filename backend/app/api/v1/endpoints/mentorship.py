from typing import Any, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api import deps
from app.core.database import get_db
from app.models.user import User, UserRole, UserProfile
from app.models.mentorship import MentorshipRequest, MentorshipRelationship, MentorshipStatus
from app.schemas.mentorship import (
    MentorshipRequestCreate,
    MentorshipRequestRead,
    MentorshipRelationshipRead,
    BecomeMentorRequest,
)
from app.api.v1.endpoints.profile import get_profile_data
from app.schemas.profile import ProfileRead

router = APIRouter()

@router.post("/become", response_model=ProfileRead)
async def become_mentor(
    payload: BecomeMentorRequest,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Allow an ALUMNI user to opt into mentor capabilities.
    """
    if current_user.role != UserRole.ALUMNI:
        raise HTTPException(status_code=403, detail="Only alumni can become mentors.")
    if current_user.is_mentor:
        # Already a mentor; return profile
        return await get_profile_data(current_user, db)
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

    db.add(user)
    db.add(user.profile)
    await db.commit()
    await db.refresh(user)

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
        select(User).where(User.id == request_in.receiver_id)
    )
    receiver = receiver_result.scalars().first()
    if not receiver or receiver.role != UserRole.ALUMNI or not receiver.is_mentor:
        raise HTTPException(status_code=400, detail="Selected user is not available as a mentor")

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
        )
    )
    result = await db.execute(stmt)
    existing_rel = result.scalars().first()
    if existing_rel:
        raise HTTPException(status_code=400, detail="Mentorship relationship already exists")

    request = MentorshipRequest(
        sender_id=current_user.id,
        receiver_id=request_in.receiver_id,
        message=request_in.message,
        status=MentorshipStatus.PENDING
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)
    
    # Populate sender/receiver for response
    # We can fetch them or just return basic info. 
    # For MVP, let's try to populate if possible, or client can fetch.
    # But schema expects ProfileRead.
    # We'll fetch them.
    
    # Actually, we can just return the request and let frontend fetch profiles if needed, 
    # or we can populate.
    # Let's populate.
    
    # Fetch sender (current_user) profile
    sender_profile = await get_profile_data(current_user, db)
    
    # Fetch receiver profile
    stmt = select(User).options(selectinload(User.profile)).where(User.id == request_in.receiver_id)
    result = await db.execute(stmt)
    receiver = result.scalars().first()
    if not receiver:
        # Should not happen if FK constraint holds, but...
        raise HTTPException(status_code=404, detail="Receiver not found")
    receiver_profile = await get_profile_data(receiver, db)
    
    response = MentorshipRequestRead.model_validate(request)
    response.sender = sender_profile
    response.receiver = receiver_profile
    
    return response

@router.get("/requests/incoming", response_model=List[MentorshipRequestRead])
async def get_incoming_requests(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    if current_user.role != UserRole.ALUMNI or not current_user.is_mentor:
        raise HTTPException(status_code=403, detail="Only mentors can view incoming requests")

    stmt = select(MentorshipRequest).where(
        MentorshipRequest.receiver_id == current_user.id,
        MentorshipRequest.status == MentorshipStatus.PENDING
    ).order_by(MentorshipRequest.created_at.desc())
    
    result = await db.execute(stmt)
    requests = result.scalars().all()
    
    response_items = []
    for req in requests:
        item = MentorshipRequestRead.model_validate(req)
        # Populate sender
        stmt_user = select(User).options(selectinload(User.profile)).where(User.id == req.sender_id)
        res_user = await db.execute(stmt_user)
        sender = res_user.scalars().first()
        if sender:
            item.sender = await get_profile_data(sender, db)
        response_items.append(item)
        
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
        item = MentorshipRequestRead.model_validate(req)
        # Populate receiver
        stmt_user = select(User).options(selectinload(User.profile)).where(User.id == req.receiver_id)
        res_user = await db.execute(stmt_user)
        receiver = res_user.scalars().first()
        if receiver:
            item.receiver = await get_profile_data(receiver, db)
        response_items.append(item)
        
    return response_items

@router.put("/requests/{request_id}/accept", response_model=MentorshipRequestRead)
async def accept_request(
    request_id: str,
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

    if current_user.role != UserRole.ALUMNI or not current_user.is_mentor:
        raise HTTPException(status_code=403, detail="Only mentors can decline requests")

    if current_user.role != UserRole.ALUMNI or not current_user.is_mentor:
        raise HTTPException(status_code=403, detail="Only mentors can accept requests")
        
    # Update status
    request.status = MentorshipStatus.ACCEPTED
    request.updated_at = datetime.utcnow() # Manually update timestamp if needed or rely on onupdate
    
    # Create relationship
    # Sender is Mentee, Receiver (Current User) is Mentor? 
    # Or depends on who asked whom.
    # Usually Mentee asks Mentor.
    # So Sender = Mentee, Receiver = Mentor.
    
    relationship = MentorshipRelationship(
        mentor_id=current_user.id,
        mentee_id=request.sender_id,
        goals=request.message # Copy message as initial goals?
    )
    db.add(relationship)
    db.add(request)
    await db.commit()
    await db.refresh(request)
    
    return request

@router.put("/requests/{request_id}/decline", response_model=MentorshipRequestRead)
async def decline_request(
    request_id: str,
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
        
    request.status = MentorshipStatus.DECLINED
    db.add(request)
    await db.commit()
    await db.refresh(request)
    
    return request

@router.get("/relationships", response_model=List[MentorshipRelationshipRead])
async def get_relationships(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    stmt = select(MentorshipRelationship).where(
        or_(
            MentorshipRelationship.mentor_id == current_user.id,
            MentorshipRelationship.mentee_id == current_user.id
        )
    )
    result = await db.execute(stmt)
    rels = result.scalars().all()
    
    response_items = []
    for rel in rels:
        item = MentorshipRelationshipRead.model_validate(rel)
        
        # Populate mentor
        stmt_mentor = select(User).options(selectinload(User.profile)).where(User.id == rel.mentor_id)
        res_mentor = await db.execute(stmt_mentor)
        mentor = res_mentor.scalars().first()
        if mentor:
            item.mentor = await get_profile_data(mentor, db)
            
        # Populate mentee
        stmt_mentee = select(User).options(selectinload(User.profile)).where(User.id == rel.mentee_id)
        res_mentee = await db.execute(stmt_mentee)
        mentee = res_mentee.scalars().first()
        if mentee:
            item.mentee = await get_profile_data(mentee, db)
            
        response_items.append(item)
        
    return response_items
