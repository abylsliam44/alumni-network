"""
Event API endpoints with full feature set:
- CRUD operations with admin approval flow
- Registration with capacity limit and waitlist
- Speakers, materials, reviews, and chat messages
"""
from datetime import datetime, timedelta
from typing import Any, Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api import deps
from app.core.database import get_db
from app.models.event import (
    Event, EventRegistration, EventSpeaker, EventMaterial, EventReview, EventMessage,
    EventType, EventFormat, EventStatus, RegistrationStatus, MaterialType
)
from app.models.user import User, UserRole
from app.models.notification import Notification, NotificationType
from app.schemas.event import (
    EventCreate, EventRead, EventUpdate, EventList, EventApproval,
    SpeakerCreate, SpeakerRead,
    MaterialCreate, MaterialRead,
    ReviewCreate, ReviewRead, ReviewList,
    EventMessageCreate, EventMessageRead, EventMessageList,
    EventRegistrationRead, AttendeesList,
    EventTypeEnum, EventFormatEnum, EventStatusEnum, RegistrationStatusEnum,
    OrganizerInfo
)
from app.services.email_service import email_service

router = APIRouter()


# =====================
# Helper Functions
# =====================

async def get_event_or_404(db: AsyncSession, event_id: UUID) -> Event:
    """Get event by ID or raise 404."""
    result = await db.execute(
        select(Event)
        .options(selectinload(Event.organizer))
        .where(Event.id == event_id)
    )
    event = result.scalars().first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


async def get_event_for_update_or_404(db: AsyncSession, event_id: UUID) -> Event:
    """Lock an event row for workflows that depend on capacity/order guarantees."""
    result = await db.execute(
        select(Event)
        .options(selectinload(Event.organizer))
        .where(Event.id == event_id)
        .with_for_update()
    )
    event = result.scalars().first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


def can_moderate_events(user: Optional[User]) -> bool:
    return bool(user and (user.is_admin or user.role == UserRole.STAFF))


async def get_registration_counts(db: AsyncSession, event_id: UUID) -> tuple[int, int]:
    """Get registered and waitlisted counts for an event."""
    registered = await db.execute(
        select(func.count()).where(
            and_(
                EventRegistration.event_id == event_id,
                EventRegistration.status == RegistrationStatus.REGISTERED
            )
        )
    )
    waitlisted = await db.execute(
        select(func.count()).where(
            and_(
                EventRegistration.event_id == event_id,
                EventRegistration.status == RegistrationStatus.WAITLISTED
            )
        )
    )
    return registered.scalar_one(), waitlisted.scalar_one()


def event_to_read(event: Event, reg_count: int = 0, wait_count: int = 0, 
                  is_registered: bool = False, reg_status: Optional[RegistrationStatus] = None,
                  include_speakers: bool = False, include_materials: bool = False) -> EventRead:
    """Convert Event model to EventRead schema."""
    organizer_info = None
    if event.organizer:
        organizer_info = OrganizerInfo(
            id=event.organizer.id,
            name=event.organizer.name,
            photo_url=event.organizer.photo_url
        )
    
    speakers = None
    materials = None
    if include_speakers and event.speakers:
        speakers = [SpeakerRead(
            id=s.id, event_id=s.event_id, name=s.name, link=s.link,
            user_id=s.user_id, created_at=s.created_at,
            user_name=s.user.name if s.user else None
        ) for s in event.speakers]
    if include_materials and event.materials:
        materials = [MaterialRead(
            id=m.id, event_id=m.event_id, title=m.title, url=m.url,
            type=m.type.value, created_at=m.created_at
        ) for m in event.materials]
    
    return EventRead(
        id=event.id,
        title=event.title,
        description=event.description,
        topic=event.topic,
        type=event.type.value,
        format=event.format.value,
        status=event.status.value,
        start_time=event.start_time,
        end_time=event.end_time,
        capacity=event.capacity,
        location=event.location,
        online_link=event.online_link,
        company_name=event.company_name,
        organizer_id=event.organizer_id,
        organizer=organizer_info,
        approved_by=event.approved_by,
        approved_at=event.approved_at,
        created_at=event.created_at,
        updated_at=event.updated_at,
        registrations_count=reg_count,
        waitlist_count=wait_count,
        is_registered=is_registered,
        registration_status=reg_status.value if reg_status else None,
        speakers=speakers,
        materials=materials
    )


async def promote_from_waitlist(db: AsyncSession, event: Event, background_tasks: BackgroundTasks):
    """Promote the first waitlisted user to registered status."""
    # Get first waitlisted user by position
    result = await db.execute(
        select(EventRegistration)
        .options(selectinload(EventRegistration.user))
        .where(
            and_(
                EventRegistration.event_id == event.id,
                EventRegistration.status == RegistrationStatus.WAITLISTED
            )
        )
        .order_by(EventRegistration.waitlist_position.asc())
        .limit(1)
    )
    waitlisted = result.scalars().first()
    
    if waitlisted:
        waitlisted.status = RegistrationStatus.REGISTERED
        waitlisted.waitlist_position = None
        
        # Create notification
        notification = Notification(
            user_id=waitlisted.user_id,
            type=NotificationType.EVENT_WAITLIST_PROMOTED,
            title="You're registered!",
            message=f"A spot opened up! You're now registered for {event.title}",
            reference_id=event.id
        )
        db.add(notification)
        
        # Send email in background
        if waitlisted.user:
            background_tasks.add_task(
                email_service.send_waitlist_promotion,
                waitlisted.user.email,
                waitlisted.user.name,
                event.title,
                event.start_time.strftime("%B %d, %Y at %I:%M %p")
            )
        
        # Keep positions contiguous after the promoted attendee leaves the queue.
        remaining_waitlist = (
            await db.execute(
                select(EventRegistration)
                .where(
                    and_(
                        EventRegistration.event_id == event.id,
                        EventRegistration.status == RegistrationStatus.WAITLISTED
                    )
                )
                .order_by(EventRegistration.waitlist_position.asc(), EventRegistration.created_at.asc())
            )
        )
        for index, queued_registration in enumerate(remaining_waitlist.scalars().all(), start=1):
            queued_registration.waitlist_position = index


# =====================
# Event CRUD Endpoints
# =====================

@router.get("", response_model=EventList)
async def list_events(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    type: Optional[EventTypeEnum] = None,
    format: Optional[EventFormatEnum] = None,
    status: Optional[EventStatusEnum] = None,
    upcoming_only: bool = True,
    search: Optional[str] = None,
) -> Any:
    """
    List events with filters.
    - Public users see only approved events
    - Staff/admins can see all events
    - Organizers can see their own draft/pending events
    """
    stmt = select(Event).options(selectinload(Event.organizer))
    
    # Build filter conditions
    conditions = []
    
    # Status filter - non-moderators only see approved (unless it's their own event)
    if can_moderate_events(current_user):
        if status:
            conditions.append(Event.status == EventStatus(status.value))
    else:
        if current_user:
            # User can see approved events or their own events
            conditions.append(
                or_(
                    Event.status == EventStatus.APPROVED,
                    Event.organizer_id == current_user.id
                )
            )
        else:
            conditions.append(Event.status == EventStatus.APPROVED)
    
    if type:
        conditions.append(Event.type == EventType(type.value))
    if format:
        conditions.append(Event.format == EventFormat(format.value))
    if upcoming_only:
        conditions.append(Event.start_time >= datetime.utcnow())
    if search:
        search_term = f"%{search}%"
        conditions.append(
            or_(
                Event.title.ilike(search_term),
                Event.topic.ilike(search_term),
                Event.description.ilike(search_term)
            )
        )
    
    if conditions:
        stmt = stmt.where(and_(*conditions))
    
    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()
    pages = (total + limit - 1) // limit if total else 1
    
    # Get events
    stmt = stmt.order_by(Event.start_time.asc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(stmt)
    events = result.scalars().all()
    
    # Build response
    items = []
    for event in events:
        reg_count, wait_count = await get_registration_counts(db, event.id)
        
        # Check if current user is registered
        is_registered = False
        reg_status = None
        if current_user:
            reg_result = await db.execute(
                select(EventRegistration).where(
                    and_(
                        EventRegistration.event_id == event.id,
                        EventRegistration.user_id == current_user.id,
                        EventRegistration.status != RegistrationStatus.CANCELLED
                    )
                )
            )
            user_reg = reg_result.scalars().first()
            if user_reg:
                is_registered = True
                reg_status = user_reg.status
        
        items.append(event_to_read(event, reg_count, wait_count, is_registered, reg_status))
    
    return EventList(items=items, total=total, pages=pages, page=page, limit=limit)


@router.post("", response_model=EventRead, status_code=status.HTTP_201_CREATED)
async def create_event(
    event_in: EventCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Create a new event.
    Any authenticated active user can create an event.
    Events start as drafts and must be submitted for staff/admin approval.
    """
    # Create event
    event = Event(
        title=event_in.title,
        description=event_in.description,
        topic=event_in.topic,
        type=EventType(event_in.type.value),
        format=EventFormat(event_in.format.value),
        status=EventStatus.DRAFT,
        start_time=event_in.start_time,
        end_time=event_in.end_time,
        capacity=event_in.capacity,
        location=event_in.location,
        online_link=event_in.online_link,
        company_name=event_in.company_name,
        organizer_id=current_user.id,
        approved_by=None,
        approved_at=None,
        is_public=event_in.type != EventTypeEnum.INVITE_ONLY
    )
    db.add(event)
    await db.flush()
    
    # Add speakers if provided
    if event_in.speakers:
        for speaker_data in event_in.speakers:
            speaker = EventSpeaker(
                event_id=event.id,
                name=speaker_data.name,
                link=speaker_data.link,
                user_id=speaker_data.user_id
            )
            db.add(speaker)
    
    # Add materials if provided
    if event_in.materials:
        for material_data in event_in.materials:
            material = EventMaterial(
                event_id=event.id,
                title=material_data.title,
                url=material_data.url,
                type=MaterialType(material_data.type.value)
            )
            db.add(material)

    await db.commit()
    await db.refresh(event)
    
    return event_to_read(event, 0, 0)


@router.get("/{event_id}", response_model=EventRead)
async def get_event(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(deps.get_current_user_optional),
) -> Any:
    """Get event details with speakers and materials."""
    result = await db.execute(
        select(Event)
        .options(
            selectinload(Event.organizer),
            selectinload(Event.speakers).selectinload(EventSpeaker.user),
            selectinload(Event.materials)
        )
        .where(Event.id == event_id)
    )
    event = result.scalars().first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check visibility
    if event.status != EventStatus.APPROVED:
        if not current_user:
            raise HTTPException(status_code=404, detail="Event not found")
        if event.organizer_id != current_user.id and not can_moderate_events(current_user):
            raise HTTPException(status_code=404, detail="Event not found")
    
    reg_count, wait_count = await get_registration_counts(db, event.id)
    
    # Check user registration
    is_registered = False
    reg_status = None
    if current_user:
        reg_result = await db.execute(
            select(EventRegistration).where(
                and_(
                    EventRegistration.event_id == event.id,
                    EventRegistration.user_id == current_user.id,
                    EventRegistration.status != RegistrationStatus.CANCELLED
                )
            )
        )
        user_reg = reg_result.scalars().first()
        if user_reg:
            is_registered = True
            reg_status = user_reg.status
    
    return event_to_read(event, reg_count, wait_count, is_registered, reg_status, True, True)


@router.put("/{event_id}", response_model=EventRead)
async def update_event(
    event_id: UUID,
    event_in: EventUpdate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Update event.
    Only organizer or admin can update.
    Cannot update approved events (must be draft or pending).
    """
    event = await get_event_or_404(db, event_id)
    
    # Check permissions
    if event.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to update this event")
    
    # Cannot update approved/completed events
    if event.status in [EventStatus.APPROVED, EventStatus.COMPLETED]:
        raise HTTPException(status_code=400, detail="Cannot update approved or completed events")
    
    # Update fields
    update_data = event_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        if field == "type" and value:
            value = EventType(value.value)
        elif field == "format" and value:
            value = EventFormat(value.value)
        setattr(event, field, value)
    
    await db.commit()
    await db.refresh(event)
    
    reg_count, wait_count = await get_registration_counts(db, event.id)
    return event_to_read(event, reg_count, wait_count)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete event. Only organizer or admin can delete."""
    event = await get_event_or_404(db, event_id)
    
    if event.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this event")
    
    await db.delete(event)
    await db.commit()


# =====================
# Event Workflow Endpoints
# =====================

@router.post("/{event_id}/submit", response_model=EventRead)
async def submit_for_approval(
    event_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Submit event for admin approval. Changes status from draft to pending."""
    event = await get_event_or_404(db, event_id)
    
    if event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the organizer can submit for approval")
    
    if event.status != EventStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only draft events can be submitted")
    
    event.status = EventStatus.PENDING
    await db.commit()
    await db.refresh(event)
    
    reg_count, wait_count = await get_registration_counts(db, event.id)
    return event_to_read(event, reg_count, wait_count)


@router.post("/{event_id}/approve", response_model=EventRead)
async def approve_event(
    event_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
    background_tasks: BackgroundTasks = None,
) -> Any:
    """Admin or Staff approves an event."""
    if not current_user.is_admin and current_user.role != UserRole.STAFF:
        raise HTTPException(status_code=403, detail="Only admins and staff can approve events")
    
    event = await get_event_or_404(db, event_id)
    
    if event.status != EventStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending events can be approved")
    
    event.status = EventStatus.APPROVED
    event.approved_by = current_user.id
    event.approved_at = datetime.utcnow()
    
    # Create notification for organizer
    notification = Notification(
        user_id=event.organizer_id,
        type=NotificationType.EVENT_APPROVED,
        title="Event Approved",
        message=f"Your event '{event.title}' has been approved!",
        reference_id=event.id,
        actor_id=current_user.id
    )
    db.add(notification)
    
    await db.commit()
    await db.refresh(event)
    
    # Send email
    if background_tasks and event.organizer:
        background_tasks.add_task(
            email_service.send_event_approved,
            event.organizer.email,
            event.organizer.name,
            event.title
        )
    
    reg_count, wait_count = await get_registration_counts(db, event.id)
    return event_to_read(event, reg_count, wait_count)


@router.post("/{event_id}/reject", response_model=EventRead)
async def reject_event(
    event_id: UUID,
    approval: EventApproval,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Admin or Staff rejects an event, returning it to draft status."""
    if not current_user.is_admin and current_user.role != UserRole.STAFF:
        raise HTTPException(status_code=403, detail="Only admins and staff can reject events")
    
    event = await get_event_or_404(db, event_id)
    
    if event.status != EventStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending events can be rejected")
    
    event.status = EventStatus.DRAFT
    
    # Create notification for organizer
    message = f"Your event '{event.title}' needs revisions."
    if approval.reason:
        message += f" Reason: {approval.reason}"
    
    notification = Notification(
        user_id=event.organizer_id,
        type=NotificationType.EVENT_APPROVED,  # Using same type for notification display
        title="Event Needs Revisions",
        message=message,
        reference_id=event.id,
        actor_id=current_user.id
    )
    db.add(notification)
    
    await db.commit()
    await db.refresh(event)
    
    reg_count, wait_count = await get_registration_counts(db, event.id)
    return event_to_read(event, reg_count, wait_count)


@router.post("/{event_id}/cancel", response_model=EventRead)
async def cancel_event(
    event_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
    background_tasks: BackgroundTasks = None,
) -> Any:
    """Cancel an event. Notifies all registered users."""
    event = await get_event_or_404(db, event_id)
    
    if event.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this event")
    
    if event.status == EventStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Event is already cancelled")
    
    event.status = EventStatus.CANCELLED
    
    # Get all registered users and notify them
    registrations = await db.execute(
        select(EventRegistration)
        .options(selectinload(EventRegistration.user))
        .where(
            and_(
                EventRegistration.event_id == event_id,
                EventRegistration.status.in_([RegistrationStatus.REGISTERED, RegistrationStatus.WAITLISTED])
            )
        )
    )
    
    for reg in registrations.scalars().all():
        # Update registration status
        reg.status = RegistrationStatus.CANCELLED
        
        # Create notification
        notification = Notification(
            user_id=reg.user_id,
            type=NotificationType.EVENT_CANCELLED,
            title="Event Cancelled",
            message=f"The event '{event.title}' has been cancelled.",
            reference_id=event.id
        )
        db.add(notification)
        
        # Send email
        if background_tasks and reg.user:
            background_tasks.add_task(
                email_service.send_event_cancellation,
                reg.user.email,
                reg.user.name,
                event.title
            )
    
    await db.commit()
    await db.refresh(event)
    
    return event_to_read(event, 0, 0)


# =====================
# Registration Endpoints
# =====================

@router.post("/{event_id}/register", response_model=EventRegistrationRead, status_code=status.HTTP_201_CREATED)
async def register_for_event(
    event_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
    background_tasks: BackgroundTasks = None,
) -> Any:
    """
    Register for an event.
    - If capacity available: status = REGISTERED
    - If at capacity: status = WAITLISTED
    """
    event = await get_event_for_update_or_404(db, event_id)
    
    # Check event is open for registration
    if event.status != EventStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Event is not open for registration")
    
    if event.start_time < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Event has already started")
    
    # Check if already registered
    existing = await db.execute(
        select(EventRegistration).where(
            and_(
                EventRegistration.event_id == event_id,
                EventRegistration.user_id == current_user.id,
                EventRegistration.status != RegistrationStatus.CANCELLED
            )
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Already registered for this event")
    
    # Determine registration status based on capacity
    reg_count, _ = await get_registration_counts(db, event_id)
    
    if event.capacity is None or reg_count < event.capacity:
        # Direct registration
        registration = EventRegistration(
            event_id=event_id,
            user_id=current_user.id,
            status=RegistrationStatus.REGISTERED
        )
        notification_type = NotificationType.EVENT_REGISTRATION
        notification_title = "Registration Confirmed"
        notification_message = f"You're registered for {event.title}!"
        
        # Send confirmation email
        if background_tasks:
            background_tasks.add_task(
                email_service.send_registration_confirmation,
                current_user.email,
                current_user.name,
                event.title,
                event.start_time.strftime("%B %d, %Y at %I:%M %p"),
                event.location
            )
    else:
        # Add to waitlist
        wait_result = await db.execute(
            select(func.max(EventRegistration.waitlist_position)).where(
                and_(
                    EventRegistration.event_id == event_id,
                    EventRegistration.status == RegistrationStatus.WAITLISTED
                )
            )
        )
        max_position = wait_result.scalar_one() or 0
        
        registration = EventRegistration(
            event_id=event_id,
            user_id=current_user.id,
            status=RegistrationStatus.WAITLISTED,
            waitlist_position=max_position + 1
        )
        notification_type = NotificationType.EVENT_WAITLIST
        notification_title = "Added to Waitlist"
        notification_message = f"You're #{max_position + 1} on the waitlist for {event.title}"
        
        # Send waitlist email
        if background_tasks:
            background_tasks.add_task(
                email_service.send_waitlist_notification,
                current_user.email,
                current_user.name,
                event.title,
                max_position + 1
            )
    
    db.add(registration)
    
    # Create notification
    notification = Notification(
        user_id=current_user.id,
        type=notification_type,
        title=notification_title,
        message=notification_message,
        reference_id=event.id
    )
    db.add(notification)
    
    await db.commit()
    await db.refresh(registration)
    
    return EventRegistrationRead(
        id=registration.id,
        event_id=registration.event_id,
        user_id=registration.user_id,
        status=registration.status.value,
        waitlist_position=registration.waitlist_position,
        user_name=current_user.name,
        user_photo=current_user.photo_url,
        created_at=registration.created_at
    )


@router.post("/{event_id}/unregister", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_from_event(
    event_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
    background_tasks: BackgroundTasks = None,
) -> None:
    """
    Cancel registration for an event.
    If user was registered (not waitlisted), promotes first waitlisted person.
    """
    event = await get_event_for_update_or_404(db, event_id)
    
    # Find registration
    result = await db.execute(
        select(EventRegistration).where(
            and_(
                EventRegistration.event_id == event_id,
                EventRegistration.user_id == current_user.id,
                EventRegistration.status != RegistrationStatus.CANCELLED
            )
        )
    )
    registration = result.scalars().first()
    
    if not registration:
        raise HTTPException(status_code=404, detail="Not registered for this event")
    
    was_registered = registration.status == RegistrationStatus.REGISTERED
    registration.status = RegistrationStatus.CANCELLED
    registration.waitlist_position = None
    
    # Promote from waitlist if user was registered (not waitlisted)
    if was_registered and background_tasks:
        await promote_from_waitlist(db, event, background_tasks)
    
    await db.commit()


@router.get("/{event_id}/attendees", response_model=AttendeesList)
async def get_attendees(
    event_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get list of registered and waitlisted attendees."""
    event = await get_event_or_404(db, event_id)
    
    # Only organizer and admin can see full attendee list
    if event.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view attendees")
    
    result = await db.execute(
        select(EventRegistration)
        .options(selectinload(EventRegistration.user))
        .where(EventRegistration.event_id == event_id)
        .order_by(EventRegistration.created_at.asc())
    )
    registrations = result.scalars().all()
    
    registered = []
    waitlisted = []
    
    for reg in registrations:
        reg_read = EventRegistrationRead(
            id=reg.id,
            event_id=reg.event_id,
            user_id=reg.user_id,
            status=reg.status.value,
            waitlist_position=reg.waitlist_position,
            user_name=reg.user.name if reg.user else "Unknown",
            user_photo=reg.user.photo_url if reg.user else None,
            created_at=reg.created_at
        )
        if reg.status == RegistrationStatus.REGISTERED:
            registered.append(reg_read)
        elif reg.status == RegistrationStatus.WAITLISTED:
            waitlisted.append(reg_read)
    
    # Sort waitlisted by position
    waitlisted.sort(key=lambda x: x.waitlist_position or 999)
    
    return AttendeesList(
        registered=registered,
        waitlisted=waitlisted,
        total_registered=len(registered),
        total_waitlisted=len(waitlisted)
    )


@router.get("/registrations/me", response_model=List[EventRegistrationRead])
async def my_registrations(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get current user's event registrations."""
    result = await db.execute(
        select(EventRegistration)
        .where(
            and_(
                EventRegistration.user_id == current_user.id,
                EventRegistration.status != RegistrationStatus.CANCELLED
            )
        )
        .order_by(EventRegistration.created_at.desc())
    )
    registrations = result.scalars().all()
    
    return [
        EventRegistrationRead(
            id=reg.id,
            event_id=reg.event_id,
            user_id=reg.user_id,
            status=reg.status.value,
            waitlist_position=reg.waitlist_position,
            user_name=current_user.name,
            user_photo=current_user.photo_url,
            created_at=reg.created_at
        )
        for reg in registrations
    ]


# =====================
# Reviews Endpoints
# =====================

@router.get("/{event_id}/reviews", response_model=ReviewList)
async def get_reviews(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> Any:
    """Get reviews for an event."""
    event = await get_event_or_404(db, event_id)
    
    # Count total and average
    count_result = await db.execute(
        select(func.count(), func.avg(EventReview.rating)).where(EventReview.event_id == event_id)
    )
    count, avg_rating = count_result.first()
    
    # Get reviews
    result = await db.execute(
        select(EventReview)
        .options(selectinload(EventReview.user))
        .where(EventReview.event_id == event_id)
        .order_by(EventReview.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    reviews = result.scalars().all()
    
    items = [
        ReviewRead(
            id=r.id,
            event_id=r.event_id,
            user_id=r.user_id,
            rating=r.rating,
            comment=r.comment,
            user_name=r.user.name if r.user else "Unknown",
            user_photo=r.user.photo_url if r.user else None,
            created_at=r.created_at
        )
        for r in reviews
    ]
    
    return ReviewList(
        items=items,
        total=count or 0,
        average_rating=float(avg_rating) if avg_rating else 0.0
    )


@router.post("/{event_id}/reviews", response_model=ReviewRead, status_code=status.HTTP_201_CREATED)
async def create_review(
    event_id: UUID,
    review_in: ReviewCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Create a review for an event.
    Only available after event has started.
    User must be registered for the event.
    """
    event = await get_event_or_404(db, event_id)
    
    # Check event has started
    if event.start_time > datetime.utcnow():
        raise HTTPException(status_code=400, detail="Reviews are only available after the event starts")
    
    # Check user is registered
    reg_result = await db.execute(
        select(EventRegistration).where(
            and_(
                EventRegistration.event_id == event_id,
                EventRegistration.user_id == current_user.id,
                EventRegistration.status == RegistrationStatus.REGISTERED
            )
        )
    )
    if not reg_result.scalars().first():
        raise HTTPException(status_code=403, detail="Only registered participants can leave reviews")
    
    # Check if already reviewed
    existing = await db.execute(
        select(EventReview).where(
            and_(
                EventReview.event_id == event_id,
                EventReview.user_id == current_user.id
            )
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="You have already reviewed this event")
    
    review = EventReview(
        event_id=event_id,
        user_id=current_user.id,
        rating=review_in.rating,
        comment=review_in.comment
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    
    return ReviewRead(
        id=review.id,
        event_id=review.event_id,
        user_id=review.user_id,
        rating=review.rating,
        comment=review.comment,
        user_name=current_user.name,
        user_photo=current_user.photo_url,
        created_at=review.created_at
    )


# =====================
# Chat/Messages Endpoints
# =====================

@router.get("/{event_id}/messages", response_model=EventMessageList)
async def get_messages(
    event_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
    before: Optional[datetime] = None,
    limit: int = Query(50, ge=1, le=100),
) -> Any:
    """
    Get chat messages for an event.
    Only available after event has started.
    User must be registered.
    """
    event = await get_event_or_404(db, event_id)
    
    # Check event has started
    if event.start_time > datetime.utcnow():
        raise HTTPException(status_code=400, detail="Chat is only available after the event starts")
    
    # Check user is registered
    reg_result = await db.execute(
        select(EventRegistration).where(
            and_(
                EventRegistration.event_id == event_id,
                EventRegistration.user_id == current_user.id,
                EventRegistration.status == RegistrationStatus.REGISTERED
            )
        )
    )
    if not reg_result.scalars().first():
        raise HTTPException(status_code=403, detail="Only registered participants can access the chat")
    
    stmt = (
        select(EventMessage)
        .options(selectinload(EventMessage.user))
        .where(EventMessage.event_id == event_id)
    )
    if before:
        stmt = stmt.where(EventMessage.created_at < before)
    
    stmt = stmt.order_by(EventMessage.created_at.desc()).limit(limit)
    
    result = await db.execute(stmt)
    messages = result.scalars().all()
    
    # Count total
    count_result = await db.execute(
        select(func.count()).where(EventMessage.event_id == event_id)
    )
    total = count_result.scalar_one()
    
    items = [
        EventMessageRead(
            id=m.id,
            event_id=m.event_id,
            user_id=m.user_id,
            content=m.content,
            user_name=m.user.name if m.user else "Unknown",
            user_photo=m.user.photo_url if m.user else None,
            created_at=m.created_at
        )
        for m in reversed(messages)  # Return in chronological order
    ]
    
    return EventMessageList(items=items, total=total)


@router.post("/{event_id}/messages", response_model=EventMessageRead, status_code=status.HTTP_201_CREATED)
async def create_message(
    event_id: UUID,
    message_in: EventMessageCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Post a message to event chat.
    Only available after event has started.
    User must be registered.
    """
    event = await get_event_or_404(db, event_id)
    
    # Check event has started
    if event.start_time > datetime.utcnow():
        raise HTTPException(status_code=400, detail="Chat is only available after the event starts")
    
    # Check user is registered
    reg_result = await db.execute(
        select(EventRegistration).where(
            and_(
                EventRegistration.event_id == event_id,
                EventRegistration.user_id == current_user.id,
                EventRegistration.status == RegistrationStatus.REGISTERED
            )
        )
    )
    if not reg_result.scalars().first():
        raise HTTPException(status_code=403, detail="Only registered participants can post messages")
    
    message = EventMessage(
        event_id=event_id,
        user_id=current_user.id,
        content=message_in.content
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    
    return EventMessageRead(
        id=message.id,
        event_id=message.event_id,
        user_id=message.user_id,
        content=message.content,
        user_name=current_user.name,
        user_photo=current_user.photo_url,
        created_at=message.created_at
    )


# =====================
# Speakers Endpoints
# =====================

@router.post("/{event_id}/speakers", response_model=SpeakerRead, status_code=status.HTTP_201_CREATED)
async def add_speaker(
    event_id: UUID,
    speaker_in: SpeakerCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Add a speaker to an event."""
    event = await get_event_or_404(db, event_id)
    
    if event.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to modify speakers")
    
    speaker = EventSpeaker(
        event_id=event_id,
        name=speaker_in.name,
        link=speaker_in.link,
        user_id=speaker_in.user_id
    )
    db.add(speaker)
    await db.commit()
    await db.refresh(speaker)
    
    # Get user name if linked
    user_name = None
    if speaker.user_id:
        user_result = await db.execute(select(User).where(User.id == speaker.user_id))
        user = user_result.scalars().first()
        user_name = user.name if user else None
    
    return SpeakerRead(
        id=speaker.id,
        event_id=speaker.event_id,
        name=speaker.name,
        link=speaker.link,
        user_id=speaker.user_id,
        created_at=speaker.created_at,
        user_name=user_name
    )


@router.delete("/{event_id}/speakers/{speaker_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_speaker(
    event_id: UUID,
    speaker_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a speaker from an event."""
    event = await get_event_or_404(db, event_id)
    
    if event.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to modify speakers")
    
    result = await db.execute(
        select(EventSpeaker).where(
            and_(EventSpeaker.id == speaker_id, EventSpeaker.event_id == event_id)
        )
    )
    speaker = result.scalars().first()
    if not speaker:
        raise HTTPException(status_code=404, detail="Speaker not found")
    
    await db.delete(speaker)
    await db.commit()


# =====================
# Materials Endpoints
# =====================

@router.post("/{event_id}/materials", response_model=MaterialRead, status_code=status.HTTP_201_CREATED)
async def add_material(
    event_id: UUID,
    material_in: MaterialCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Add material to an event."""
    event = await get_event_or_404(db, event_id)
    
    if event.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to modify materials")
    
    material = EventMaterial(
        event_id=event_id,
        title=material_in.title,
        url=material_in.url,
        type=MaterialType(material_in.type.value)
    )
    db.add(material)
    await db.commit()
    await db.refresh(material)
    
    return MaterialRead(
        id=material.id,
        event_id=material.event_id,
        title=material.title,
        url=material.url,
        type=material.type.value,
        created_at=material.created_at
    )


@router.delete("/{event_id}/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_material(
    event_id: UUID,
    material_id: UUID,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a material from an event."""
    event = await get_event_or_404(db, event_id)
    
    if event.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to modify materials")
    
    result = await db.execute(
        select(EventMaterial).where(
            and_(EventMaterial.id == material_id, EventMaterial.event_id == event_id)
        )
    )
    material = result.scalars().first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    
    await db.delete(material)
    await db.commit()


# =====================
# Admin Endpoints
# =====================

@router.get("/admin/pending", response_model=EventList)
async def list_pending_events(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
) -> Any:
    """List all pending events for admin review."""
    if not current_user.is_admin and current_user.role != UserRole.STAFF:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    stmt = (
        select(Event)
        .options(selectinload(Event.organizer))
        .where(Event.status == EventStatus.PENDING)
        .order_by(Event.created_at.asc())
    )
    
    # Count
    count_result = await db.execute(
        select(func.count()).where(Event.status == EventStatus.PENDING)
    )
    total = count_result.scalar_one()
    pages = (total + limit - 1) // limit if total else 1
    
    # Get events
    stmt = stmt.offset((page - 1) * limit).limit(limit)
    result = await db.execute(stmt)
    events = result.scalars().all()
    
    items = []
    for event in events:
        reg_count, wait_count = await get_registration_counts(db, event.id)
        items.append(event_to_read(event, reg_count, wait_count))
    
    return EventList(items=items, total=total, pages=pages, page=page, limit=limit)
