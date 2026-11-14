"""Populate an explicitly isolated integrated demo. Never run against production."""
import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.academic.db import db, client
from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.integrated.identity import mirror_user
from app.models.user import User, UserProfile, UserRole

if os.getenv('INTEGRATED_PROJECTS_MODE') != 'true' or os.getenv('INTEGRATED_DEMO_SEED') != 'true' or db.name != 'alumni_integrated':
    raise SystemExit('Seed is restricted to an explicitly enabled integrated demo')


def identifier(name):
    return uuid.uuid5(uuid.NAMESPACE_URL, 'alumni-integrated-demo:' + name)


async def main():
    demo_ids = []
    async with AsyncSessionLocal() as session:
        for i in range(12):
            email = f'demo{i}@integrated.example.com'
            user = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
            if user is None:
                user = User(id=identifier(f'user:{i}'), email=email,
                            hashed_password=get_password_hash('DemoPass123!'),
                            name=f'Demo User {i}', role=UserRole.STUDENT if i % 2 == 0 else UserRole.ALUMNI,
                            is_active=True, is_verified=True, is_mentor=i == 1,
                            bio='Synthetic user for the local integrated demonstration.')
                session.add(user)
                session.add(UserProfile(user_id=user.id, skills=['Python', 'FastAPI'] if i == 0 else ['Python', 'React'],
                                        headline='Software developer', location='Astana'))
            demo_ids.append(user.id)
        await session.commit()
        users = (await session.execute(select(User).options(selectinload(User.profile)).where(User.id.in_(demo_ids)))).scalars().all()
        for user in users:
            await mirror_user(user)
    now = datetime.now(timezone.utc)
    for i in range(24):
        skills = ['Python', 'FastAPI'] if i == 0 else ['Python', 'React']
        doc = {
            '_id': str(identifier(f'project:{i}')), 'title': f'Demo project {i}',
            'short_description': 'A synthetic project for the integrated alumni platform.',
            'full_description': 'This demonstration project brings students and alumni together to build a useful platform.',
            'category': 'WEB_PLATFORM' if i % 2 else 'AI_ML', 'required_roles': ['BACKEND_DEVELOPER'],
            'required_skills': skills, 'required_skills_normalized': [s.casefold() for s in skills],
            'project_stage': 'MVP', 'team_size': 3, 'is_remote': True, 'contact_preference': None,
            'github_link': None, 'demo_link': None, 'tags': ['education'], 'tags_normalized': ['education'],
            'university_related': True, 'startup_idea': False, 'looking_for_cofounder': False,
            'created_by_user_id': str(demo_ids[1 + i % (len(demo_ids) - 1)]),
            'created_at': now - timedelta(days=24 - i), 'updated_at': now,
            'deleted_at': None, 'schema_version': 1,
        }
        await db.projects.update_one({'_id': doc['_id']}, {'$setOnInsert': doc}, upsert=True)
    print('Integrated demo: 12 SQL users and 24 MongoDB projects are present; existing records were not overwritten.')
    client.close()


if __name__ == '__main__':
    asyncio.run(main())
