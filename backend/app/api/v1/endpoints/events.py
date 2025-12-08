from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.models.event import Event, EventRegistration, RegistrationStatus
from app.models.user import User
from app.schemas.event import (
    EventCreate,
    EventRead,
    EventList,
    EventRegistrationRead,
    MyRegistrationsResponse,
)

router = APIRouter()


@router.get("", response_model=EventList)
async def list_events(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    upcoming_only: bool = True,
) -> Any:
    stmt = select(Event)
    if upcoming_only:
        stmt = stmt.where(Event.date_time >= func.now())

    total_result = await db.execute(stmt.with_only_columns(func.count()))
    total = total_result.scalar_one()
    pages = (total + limit - 1) // limit if total else 1

    stmt = stmt.order_by(Event.date_time.asc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(stmt)
    events = result.scalars().all()

    items: list[EventRead] = []
    for ev in events:
        reg_count = await db.execute(
            select(func.count()).select_from(EventRegistration).where(EventRegistration.event_id == ev.id)
        )
        registrations_count = reg_count.scalar_one()
        event_dict = EventRead.from_orm(ev).dict()
        event_dict["registrations_count"] = registrations_count
        items.append(EventRead(**event_dict))

    return EventList(
        items=items,
        total=total,
        pages=pages,
        page=page,
        limit=limit,
    )


@router.post("", response_model=EventRead, status_code=status.HTTP_201_CREATED)
async def create_event(
    event_in: EventCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    event = Event(**event_in.dict(), organizer_id=current_user.id)
    db.add(event)
    await db.commit()
    await db.refresh(event)
    event_dict = EventRead.from_orm(event).dict()
    event_dict["registrations_count"] = 0
    return EventRead(**event_dict)


@router.get("/{event_id}", response_model=EventRead)
async def get_event(event_id: str, db: AsyncSession = Depends(get_db)) -> Any:
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalars().first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    reg_count = await db.execute(
        select(func.count()).select_from(EventRegistration).where(EventRegistration.event_id == event.id)
    )
    registrations_count = reg_count.scalar_one()
    event_dict = EventRead.from_orm(event).dict()
    event_dict["registrations_count"] = registrations_count
    return EventRead(**event_dict)


@router.post("/{event_id}/register", response_model=EventRegistrationRead, status_code=status.HTTP_201_CREATED)
async def register_event(
    event_id: str,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalars().first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    existing = await db.execute(
        select(EventRegistration).where(
            EventRegistration.event_id == event_id,
            EventRegistration.user_id == current_user.id,
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Already registered for this event")

    registration = EventRegistration(
        event_id=event_id,
        user_id=current_user.id,
        status=RegistrationStatus.REGISTERED,
    )
    db.add(registration)
    await db.commit()
    await db.refresh(registration)
    return registration


@router.get("/registrations/me", response_model=MyRegistrationsResponse)
async def my_registrations(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(
        select(EventRegistration).where(EventRegistration.user_id == current_user.id)
    )
    regs = result.scalars().all()
    return MyRegistrationsResponse(items=regs)


