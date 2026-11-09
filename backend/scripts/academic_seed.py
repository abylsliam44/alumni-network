import argparse
import asyncio
import random
import uuid
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from app.academic.db import db, client, create_indexes
from app.domain.project_enums import ProjectCategory, ProjectStage

parser = argparse.ArgumentParser()
parser.add_argument('--seed', type=int, default=42)
parser.add_argument('--reset', action='store_true')
args = parser.parse_args()

def key(name): return str(uuid.uuid5(uuid.NAMESPACE_URL, f'alumni-academic:{args.seed}:{name}'))

async def main():
    if db.name != 'alumni_academic':
        raise SystemExit('Seed only permitted in alumni_academic database')
    if args.reset:
        for name in ('users', 'projects', 'project_applications', 'interactions'):
            await db[name].delete_many({})
    await create_indexes()
    rng = random.Random(args.seed)
    stamp = datetime(2025, 1, 1, tzinfo=timezone.utc)
    hashed = CryptContext(schemes=['bcrypt']).hash('DemoPass123!')
    skills = ['Python', 'FastAPI', 'React', 'Design', 'DevOps']
    for i in range(50):
        own_skills = ['Python', 'FastAPI'] if i == 0 else ([] if i == 1 else rng.sample(skills, rng.randrange(1, 4)))
        user = {'_id': key(f'user:{i}'), 'email': f'demo{i}@example.test', 'email_normalized': f'demo{i}@example.test', 'hashed_password': hashed, 'name': f'Demo User {i}', 'role': 'STUDENT' if i % 2 == 0 else 'ALUMNI', 'is_admin': i == 0, 'is_active': True, 'bio': 'Synthetic academic data', 'photo_url': None, 'profile': {'skills': own_skills, 'skills_normalized': [s.casefold() for s in own_skills], 'career_interests': [], 'preferred_project_categories': []}, 'created_at': stamp, 'updated_at': stamp, 'schema_version': 1}
        await db.users.update_one({'_id': user['_id']}, {'$setOnInsert': user}, upsert=True)
    categories, stages = list(ProjectCategory), list(ProjectStage)
    for i in range(120):
        required = ['Python', 'FastAPI'] if i == 0 else (['React'] if i == 1 else ['Python', rng.choice(['React', 'Design', 'DevOps'])])
        project = {'_id': key(f'project:{i}'), 'title': f'Student project {i}', 'short_description': 'A synthetic student project for demonstration.', 'full_description': 'This synthetic project is used to demonstrate academic recommendations.', 'category': categories[i % len(categories)].value, 'required_roles': ['BACKEND_DEVELOPER'], 'required_skills': required, 'required_skills_normalized': [s.casefold() for s in required], 'project_stage': stages[i % len(stages)].value, 'team_size': 3, 'is_remote': True, 'contact_preference': None, 'github_link': None, 'demo_link': None, 'tags': ['education'], 'tags_normalized': ['education'], 'university_related': True, 'startup_idea': False, 'looking_for_cofounder': False, 'created_by_user_id': key(f'user:{(i+1)%50}'), 'created_at': stamp + timedelta(days=i), 'updated_at': stamp, 'deleted_at': stamp if i == 119 else None, 'schema_version': 1}
        await db.projects.update_one({'_id': project['_id']}, {'$setOnInsert': project}, upsert=True)
    for i in range(50):
        applicant = key(f'user:{(i+2)%50}')
        project = key(f'project:{0 if i < 4 else i}')
        app = {'_id': key(f'application:{i}'), 'project_id': project, 'applicant_id': applicant, 'message': 'I would like to contribute to this project.', 'skills': ['Python'], 'fit_reason': None, 'status': 'SUBMITTED', 'applied_at': stamp, 'schema_version': 1}
        await db.project_applications.update_one({'_id': app['_id']}, {'$setOnInsert': app}, upsert=True)
        event = {'_id': key(f'apply:{i}'), 'user_id': applicant, 'item_id': project, 'item_type': 'PROJECT', 'event_type': 'APPLY', 'created_at': stamp, 'schema_version': 1}
        await db.interactions.update_one({'_id': event['_id']}, {'$setOnInsert': event}, upsert=True)
    for i in range(500):
        kind = ['VIEW', 'SAVE', 'UNSAVE', 'RATE'][i % 4]
        event = {'_id': key(f'event:{i}'), 'user_id': key(f'user:{i%50}'), 'item_id': key(f'project:{i%119}'), 'item_type': 'PROJECT', 'event_type': kind, 'created_at': stamp + timedelta(minutes=i), 'schema_version': 1}
        if kind == 'RATE': event['rating'] = (i % 5) + 1
        await db.interactions.update_one({'_id': event['_id']}, {'$setOnInsert': event}, upsert=True)
    print('Seeded 50 users, 120 projects, 50 applications and 550 interactions')
    client.close()

asyncio.run(main())
