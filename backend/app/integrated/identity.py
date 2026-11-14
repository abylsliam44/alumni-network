"""Resolve the full-platform session and mirror public profile data for projects."""
from datetime import datetime, timezone
from fastapi import HTTPException, Request
from pymongo.errors import DuplicateKeyError

from app.api.deps import get_user_from_token
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.academic.db import db
from app.academic.schemas import clean


def _interests(value):
    if isinstance(value, dict):
        parts = []
        for item in value.values():
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, list):
                parts.extend(x for x in item if isinstance(x, str))
        return clean(parts)
    return clean([item for item in value if isinstance(item, str)]) if isinstance(value, list) else []


async def mirror_user(user):
    """Mirror only public profile fields; PostgreSQL remains the identity source."""
    profile = user.profile
    raw_skills = profile.skills if profile and isinstance(profile.skills, list) else []
    skills = clean([item for item in raw_skills if isinstance(item, str)])
    stamp = datetime.now(timezone.utc)
    user_id = str(user.id)
    role = getattr(user.role, 'value', user.role)
    updated = {
        'email': user.email, 'email_normalized': user.email.strip().lower(),
        'name': user.name, 'role': role, 'is_active': bool(user.is_active),
        'is_admin': bool(user.is_admin), 'bio': user.bio, 'photo_url': user.photo_url,
        'updated_at': stamp, 'profile.skills': skills,
        'profile.skills_normalized': [item.casefold() for item in skills],
        'profile.headline': profile.headline if profile else None,
        'profile.location': profile.location if profile else None,
    }
    update = {'$set': updated, '$setOnInsert': {
        '_id': user_id, 'hashed_password': '!', 'created_at': stamp,
        'schema_version': 1, 'profile.preferred_project_categories': [],
        'profile.career_interests': _interests(profile.career_interests) if profile else [],
    }}
    try:
        await db.users.update_one({'_id': user_id}, update, upsert=True)
    except DuplicateKeyError as exc:
        # Concurrent upserts for the same ID may race; do not hide other conflicts.
        if not await db.users.find_one({'_id': user_id}, {'_id': 1}):
            raise HTTPException(409, 'Project profile conflicts with an existing user') from exc
        await db.users.update_one({'_id': user_id}, {'$set': updated})
    return await db.users.find_one({'_id': user_id})


async def integrated_user(request: Request, optional: bool = False):
    token = request.cookies.get(settings.AUTH_ACCESS_COOKIE_NAME)
    authorization = request.headers.get('authorization', '')
    if authorization.lower().startswith('bearer '):
        token = authorization[7:]
    async with AsyncSessionLocal() as session:
        user = await get_user_from_token(session, token)
        if user:
            return await mirror_user(user)
    if optional:
        return None
    raise HTTPException(401, 'Authentication required')
