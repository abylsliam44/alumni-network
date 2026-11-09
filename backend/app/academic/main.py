import math
import os
import re
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt, JWTError
from passlib.context import CryptContext
from pymongo.errors import DuplicateKeyError
from starlette.responses import JSONResponse
from app.academic.db import client, db, create_indexes
from app.academic.schemas import Application, Interaction, ProfileUpdate, Project, Register, clean
from app.domain.project_enums import ProjectCategory, ProjectRole

SECRET = os.environ['SECRET_KEY']
ALGORITHM = 'HS256'
pwd = CryptContext(schemes=['bcrypt'], deprecated='auto')
now = lambda: datetime.now(timezone.utc)
uid = lambda: str(uuid.uuid4())

@asynccontextmanager
async def lifespan(app):
    await db.command('ping')
    await create_indexes()
    yield
    client.close()

app = FastAPI(title='Alumni Academic API', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:3031', 'http://127.0.0.1:3031'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])

@app.middleware('http')
async def origin_guard(request, call_next):
    origin = request.headers.get('origin')
    if request.method in {'POST', 'PUT', 'PATCH', 'DELETE'} and origin and origin not in {'http://localhost:3031', 'http://127.0.0.1:3031'}:
        return JSONResponse({'detail': 'Invalid request origin'}, status_code=403)
    return await call_next(request)

@app.get('/api/health')
async def health():
    return {'status': 'ok'}

@app.get('/api/health/ready')
async def ready():
    try:
        await db.command('ping')
        status = await db.command('hello')
        if not status.get('isWritablePrimary') or status.get('setName') != 'rs0':
            raise ValueError('replica set not ready')
        return {'status': 'ready'}
    except Exception:
        raise HTTPException(503, 'MongoDB not ready')

def token(user_id, kind):
    expiry = timedelta(minutes=30) if kind == 'access' else timedelta(days=7)
    return jwt.encode({'sub': user_id, 'type': kind, 'exp': now() + expiry}, SECRET, algorithm=ALGORITHM)

def cookies(response, user_id):
    response.set_cookie('access_token', token(user_id, 'access'), httponly=True, samesite='lax', max_age=1800, path='/')
    response.set_cookie('refresh_token', token(user_id, 'refresh'), httponly=True, samesite='lax', max_age=604800, path='/')

async def get_user(request: Request, optional=False):
    value = request.cookies.get('access_token')
    auth = request.headers.get('authorization', '')
    if not value and auth.lower().startswith('bearer '):
        value = auth[7:]
    if value:
        try:
            data = jwt.decode(value, SECRET, algorithms=[ALGORITHM])
            if data.get('type') == 'access':
                user = await db.users.find_one({'_id': data.get('sub'), 'is_active': True})
                if user:
                    return user
        except JWTError:
            pass
    if optional:
        return None
    raise HTTPException(401, 'Authentication required')

async def current_user(request: Request):
    return await get_user(request)

async def optional_user(request: Request):
    return await get_user(request, optional=True)

def public(user):
    if not user:
        return None
    return {'id': user['_id'], 'name': user['name'], 'role': user['role'], 'bio': user.get('bio'), 'photo_url': user.get('photo_url'), **{k: v for k, v in user.get('profile', {}).items() if k != 'skills_normalized'}}

@app.post('/api/v1/auth/register', status_code=201)
async def register(body: Register, response: Response):
    stamp = now()
    email = str(body.email).strip().lower()
    user = {'_id': uid(), 'email': email, 'email_normalized': email, 'hashed_password': pwd.hash(body.password), 'name': body.name.strip(), 'role': body.role, 'is_active': True, 'is_admin': False, 'bio': None, 'photo_url': None, 'profile': {'skills': [], 'skills_normalized': [], 'career_interests': [], 'preferred_project_categories': []}, 'created_at': stamp, 'updated_at': stamp, 'schema_version': 1}
    try:
        await db.users.insert_one(user)
    except DuplicateKeyError:
        raise HTTPException(409, 'Email already registered')
    cookies(response, user['_id'])
    return {'token_type': 'bearer', 'user': public(user)}

@app.post('/api/v1/auth/login')
async def login(response: Response, form: OAuth2PasswordRequestForm = Depends()):
    user = await db.users.find_one({'email_normalized': form.username.strip().lower()})
    if not user or not user['is_active'] or not pwd.verify(form.password, user['hashed_password']):
        raise HTTPException(401, 'Incorrect email or password')
    cookies(response, user['_id'])
    return {'token_type': 'bearer'}

@app.post('/api/v1/auth/refresh')
async def refresh(request: Request, response: Response):
    try:
        data = jwt.decode(request.cookies.get('refresh_token', ''), SECRET, algorithms=[ALGORITHM])
        user = await db.users.find_one({'_id': data.get('sub'), 'is_active': True})
        if data.get('type') != 'refresh' or not user:
            raise ValueError()
    except (JWTError, ValueError):
        raise HTTPException(401, 'Invalid refresh token')
    cookies(response, user['_id'])
    return {'token_type': 'bearer'}

@app.post('/api/v1/auth/logout')
async def logout(response: Response):
    response.delete_cookie('access_token', path='/')
    response.delete_cookie('refresh_token', path='/')
    return {'ok': True}

@app.get('/api/v1/auth/me')
async def me(user=Depends(current_user)):
    return {**public(user), 'is_admin': user.get('is_admin', False)}

@app.get('/api/v1/profile/me')
async def my_profile(user=Depends(current_user)):
    return public(user)

@app.put('/api/v1/profile/me')
async def update_profile(body: ProfileUpdate, user=Depends(current_user)):
    changes = body.model_dump(exclude_unset=True)
    updates = {'updated_at': now()}
    for key, value in changes.items():
        if key in ('name', 'bio', 'photo_url'):
            if key == 'name' and (value is None or not value.strip()):
                raise HTTPException(422, 'Name cannot be empty')
            updates[key] = value
        else:
            updates['profile.' + key] = value
            if key == 'skills':
                updates['profile.skills_normalized'] = [s.casefold() for s in value or []]
    await db.users.update_one({'_id': user['_id']}, {'$set': updates})
    return public(await db.users.find_one({'_id': user['_id']}))

@app.get('/api/v1/profile/{user_id}')
async def profile(user_id: UUID, user=Depends(current_user)):
    result = await db.users.find_one({'_id': str(user_id), 'is_active': True})
    if not result:
        raise HTTPException(404, 'User not found')
    return public(result)

@app.get('/api/v1/directory/')
async def directory(query: str = '', role: Optional[str] = None, skills: Optional[str] = None, location: Optional[str] = None, graduation_year: Optional[int] = None, page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), user=Depends(current_user)):
    filters = {'is_active': True}
    if query:
        regex = re.escape(query)
        filters['$or'] = [{'name': {'$regex': regex, '$options': 'i'}}, {'bio': {'$regex': regex, '$options': 'i'}}]
    if role: filters['role'] = role
    if skills: filters['profile.skills_normalized'] = {'$all': [s.casefold() for s in clean(skills.split(','))]}
    if location: filters['profile.location'] = location
    if graduation_year: filters['profile.graduation_year'] = graduation_year
    total = await db.users.count_documents(filters)
    items = await db.users.find(filters).sort([('name', 1), ('_id', 1)]).skip((page-1)*limit).limit(limit).to_list(limit)
    return {'items': [public(x) for x in items], 'total': total, 'page': page, 'limit': limit, 'pages': max(1, math.ceil(total/limit))}

def project_data(body):
    data = body.model_dump(mode='json')
    for key in ('required_skills', 'tags'):
        data[key + '_normalized'] = [x.casefold() for x in data[key]]
    return data

def score_stages(user):
    profile = (user or {}).get('profile', {})
    skills = profile.get('skills_normalized') or []
    interests = [x.casefold() for x in clean(profile.get('career_interests') or [])]
    categories = profile.get('preferred_project_categories') or []
    def fraction(intersection, array):
        return {'$cond': [{'$gt': [{'$size': array}, 0]}, {'$divide': [{'$size': intersection}, {'$size': array}]}, 0]}
    required = {'$ifNull': ['$required_skills_normalized', []]}
    tags = {'$ifNull': ['$tags_normalized', []]}
    return [{'$set': {'match_score': {'$round': [{'$multiply': [100, {'$add': [
        {'$multiply': [0.7, fraction({'$setIntersection': [skills, required]}, required)]},
        {'$multiply': [0.2, {'$cond': [{'$in': ['$category', categories]}, 1, 0]}]},
        {'$multiply': [0.1, fraction({'$setIntersection': [interests, tags]}, tags)]}
    ]}]}, 0]}}}]

async def enrich(projects, user):
    if not projects: return []
    ids = [p['_id'] for p in projects]
    creators = {u['_id']: public(u) async for u in db.users.find({'_id': {'$in': list({p['created_by_user_id'] for p in projects})}})}
    counts = {x['_id']: x['count'] async for x in db.project_applications.aggregate([{'$match': {'project_id': {'$in': ids}}}, {'$group': {'_id': '$project_id', 'count': {'$sum': 1}}}])}
    applied = set()
    if user:
        applied = {x['project_id'] async for x in db.project_applications.find({'project_id': {'$in': ids}, 'applicant_id': user['_id']})}
    skills = set((user or {}).get('profile', {}).get('skills_normalized') or [])
    output = []
    for p in projects:
        matched = [x for x in p.get('required_skills', []) if x.casefold() in skills]
        item = {k: v for k, v in p.items() if k not in {'_id', 'schema_version', 'deleted_at', 'required_skills_normalized', 'tags_normalized', 'application_write_version', 'interaction_write_version', '_applications'}}
        item.update(id=p['_id'], creator=creators.get(p['created_by_user_id']), applications_count=counts.get(p['_id'], 0), has_applied=p['_id'] in applied, matched_skills=matched, match_score=int(p.get('match_score', 0)), recommendation_reason=('Совпадают навыки: ' + ', '.join(matched)) if matched else ('Совпадают интересы' if p.get('match_score', 0) else 'Новый проект для знакомства'))
        output.append(item)
    return output

async def listing(filters, user, page, limit, sort='latest', recommended=False):
    filters = dict(filters, deleted_at=None)
    if recommended:
        applied = await db.project_applications.distinct('project_id', {'applicant_id': user['_id']})
        filters['created_by_user_id'] = {'$ne': user['_id']}
        filters['_id'] = {'$nin': applied}
    pipeline = [{'$match': filters}] + score_stages(user)
    if sort == 'popular':
        pipeline += [{'$lookup': {'from': 'project_applications', 'localField': '_id', 'foreignField': 'project_id', 'as': '_applications'}}, {'$set': {'_count': {'$size': '$_applications'}}}]
        order = {'_count': -1, 'created_at': -1, '_id': 1}
    elif sort == 'match' or recommended:
        order = {'match_score': -1, 'created_at': -1, '_id': 1}
    else:
        order = {'created_at': -1, '_id': 1}
    pipeline += [{'$sort': order}, {'$facet': {'items': [{'$skip': (page-1)*limit}, {'$limit': limit}], 'count': [{'$count': 'total'}]}}]
    result = (await db.projects.aggregate(pipeline).to_list(1))[0]
    total = result['count'][0]['total'] if result['count'] else 0
    return {'items': await enrich(result['items'], user), 'total': total, 'pages': max(1, math.ceil(total/limit)), 'page': page, 'limit': limit}

@app.get('/api/v1/projects/recommended')
async def recommended(page: int = Query(1, ge=1), limit: int = Query(12, ge=1, le=30), user=Depends(current_user)):
    return await listing({}, user, page, limit, recommended=True)

@app.get('/api/v1/projects/saved')
async def saved(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=50), user=Depends(current_user)):
    pipeline = [{'$match': {'user_id': user['_id'], 'event_type': {'$in': ['SAVE', 'UNSAVE']}}}, {'$sort': {'created_at': -1, '_id': -1}}, {'$group': {'_id': '$item_id', 'last': {'$first': '$event_type'}}}, {'$match': {'last': 'SAVE'}}]
    ids = [x['_id'] async for x in db.interactions.aggregate(pipeline)]
    return await listing({'_id': {'$in': ids}}, user, page, limit)

@app.get('/api/v1/projects/user/{user_id}')
async def user_projects(user_id: UUID, user=Depends(optional_user)):
    identifier = str(user_id)
    created = await listing({'created_by_user_id': identifier}, user, 1, 50)
    ids = await db.project_applications.distinct('project_id', {'applicant_id': identifier})
    joined = await listing({'_id': {'$in': ids}}, user, 1, 50)
    return {'created_projects': created['items'], 'joined_projects': joined['items']}

@app.get('/api/v1/projects')
async def projects(query: str = '', category: Optional[ProjectCategory] = None, role: Optional[ProjectRole] = None, skills: Optional[str] = None, is_remote: Optional[bool] = None, university_related: Optional[bool] = None, startup_idea: Optional[bool] = None, looking_for_cofounder: Optional[bool] = None, sort: str = Query('latest', pattern='^(latest|match|popular)$'), page: int = Query(1, ge=1), limit: int = Query(12, ge=1, le=50), user=Depends(optional_user)):
    filters = {}
    if query: filters['$text'] = {'$search': query}
    if category: filters['category'] = category.value
    if role: filters['required_roles'] = role.value
    if skills: filters['required_skills_normalized'] = {'$all': [x.casefold() for x in clean(skills.split(','))]}
    for key, value in [('is_remote', is_remote), ('university_related', university_related), ('startup_idea', startup_idea), ('looking_for_cofounder', looking_for_cofounder)]:
        if value is not None: filters[key] = value
    return await listing(filters, user, page, limit, sort)

@app.post('/api/v1/projects', status_code=201)
async def create_project(body: Project, user=Depends(current_user)):
    project = dict(project_data(body), _id=uid(), created_by_user_id=user['_id'], created_at=now(), updated_at=now(), deleted_at=None, schema_version=1)
    await db.projects.insert_one(project)
    return (await enrich([project], user))[0]

async def find_project(project_id):
    result = await db.projects.find_one({'_id': str(project_id), 'deleted_at': None})
    if not result: raise HTTPException(404, 'Project not found')
    return result

def owner(project, user):
    if project['created_by_user_id'] != user['_id'] and not user.get('is_admin'):
        raise HTTPException(403, 'Access denied')

@app.get('/api/v1/projects/{project_id}')
async def get_project(project_id: UUID, user=Depends(optional_user)):
    result = await listing({'_id': str(project_id)}, user, 1, 1)
    if not result['items']: raise HTTPException(404, 'Project not found')
    return result['items'][0]

@app.put('/api/v1/projects/{project_id}')
async def update_project(project_id: UUID, body: dict, user=Depends(current_user)):
    project = await find_project(project_id)
    owner(project, user)
    allowed = set(Project.model_fields)
    if set(body) - allowed: raise HTTPException(422, 'Unknown field')
    try:
        validated = Project.model_validate({**{key: project[key] for key in allowed}, **body})
    except Exception as exc:
        raise HTTPException(422, 'Invalid project fields') from exc
    condition = {'_id': str(project_id), 'deleted_at': None}
    if not user.get('is_admin'): condition['created_by_user_id'] = user['_id']
    result = await db.projects.update_one(condition, {'$set': {**project_data(validated), 'updated_at': now()}})
    if not result.matched_count: raise HTTPException(404, 'Project not found')
    return await get_project(project_id, user)

@app.delete('/api/v1/projects/{project_id}', status_code=204)
async def delete_project(project_id: UUID, user=Depends(current_user)):
    owner(await find_project(project_id), user)
    condition = {'_id': str(project_id), 'deleted_at': None}
    if not user.get('is_admin'): condition['created_by_user_id'] = user['_id']
    result = await db.projects.update_one(condition, {'$set': {'deleted_at': now(), 'updated_at': now()}})
    if not result.matched_count: raise HTTPException(404, 'Project not found')
    return Response(status_code=204)

@app.post('/api/v1/projects/{project_id}/apply', status_code=201)
async def apply(project_id: UUID, body: Application, user=Depends(current_user)):
    project = await find_project(project_id)
    if project['created_by_user_id'] == user['_id']: raise HTTPException(403, 'Cannot apply to your own project')
    stamp = now()
    application = {'_id': uid(), 'project_id': str(project_id), 'applicant_id': user['_id'], **body.model_dump(), 'status': 'SUBMITTED', 'applied_at': stamp, 'schema_version': 1}
    event = {'_id': uid(), 'user_id': user['_id'], 'item_id': str(project_id), 'item_type': 'PROJECT', 'event_type': 'APPLY', 'created_at': stamp, 'schema_version': 1}
    async def transaction(session):
        active = await db.projects.update_one({'_id': str(project_id), 'deleted_at': None, 'created_by_user_id': {'$ne': user['_id']}}, {'$inc': {'application_write_version': 1}}, session=session)
        if not active.matched_count: raise HTTPException(404, 'Project not found')
        await db.project_applications.insert_one(application, session=session)
        await db.interactions.insert_one(event, session=session)
    try:
        async with await client.start_session() as session:
            await session.with_transaction(transaction)
    except DuplicateKeyError:
        raise HTTPException(409, 'Already applied')
    return {**{k: v for k, v in application.items() if k not in ('_id', 'schema_version')}, 'id': application['_id'], 'applicant': public(user)}

@app.get('/api/v1/projects/{project_id}/applications')
async def applications(project_id: UUID, user=Depends(current_user)):
    owner(await find_project(project_id), user)
    apps = await db.project_applications.find({'project_id': str(project_id)}).sort('applied_at', -1).to_list(None)
    users = {u['_id']: public(u) async for u in db.users.find({'_id': {'$in': [a['applicant_id'] for a in apps]}})}
    return [{**{k: v for k, v in a.items() if k not in ('_id', 'schema_version')}, 'id': a['_id'], 'applicant': users.get(a['applicant_id'])} for a in apps]

@app.get('/api/v1/projects/{project_id}/candidates')
async def candidates(project_id: UUID, limit: int = Query(10, ge=1, le=30), user=Depends(current_user)):
    project = await find_project(project_id)
    owner(project, user)
    required = set(project['required_skills_normalized'])
    result = []
    async for candidate in db.users.find({'is_active': True, '_id': {'$ne': project['created_by_user_id']}, 'profile.skills_normalized': {'$in': list(required)}}):
        skills = candidate.get('profile', {}).get('skills', [])
        matched = [x for x in skills if x.casefold() in required]
        score = round(100 * len({x.casefold() for x in matched}) / len(required)) if required else 0
        if score: result.append({'user': public(candidate), 'skills': skills, 'matched_skills': matched, 'match_score': score})
    return sorted(result, key=lambda x: (-x['match_score'], x['user']['id']))[:limit]

@app.post('/api/v1/interactions', status_code=201)
async def interaction(body: Interaction, response: Response, user=Depends(current_user)):
    event_id, item_id = str(body.event_id), str(body.item_id)
    async def existing_result(existing):
        same = existing['user_id'] == user['_id'] and existing['item_id'] == item_id and existing['event_type'] == body.event_type and existing.get('rating') == body.rating
        if not same: raise HTTPException(409, 'Event id already used')
        response.status_code = 200
        return {'id': existing['_id'], 'item_id': existing['item_id'], 'event_type': existing['event_type'], 'rating': existing.get('rating'), 'created_at': existing['created_at']}
    existing = await db.interactions.find_one({'_id': event_id})
    if existing: return await existing_result(existing)
    event = {'_id': event_id, 'user_id': user['_id'], 'item_id': item_id, 'item_type': 'PROJECT', 'event_type': body.event_type, 'created_at': now(), 'schema_version': 1}
    if body.rating is not None: event['rating'] = body.rating
    async def transaction(session):
        active = await db.projects.update_one({'_id': item_id, 'deleted_at': None}, {'$inc': {'interaction_write_version': 1}}, session=session)
        if not active.matched_count: raise HTTPException(404, 'Project not found')
        await db.interactions.insert_one(event, session=session)
    try:
        async with await client.start_session() as session:
            await session.with_transaction(transaction)
    except DuplicateKeyError:
        return await existing_result(await db.interactions.find_one({'_id': event_id}))
    return {'id': event_id, 'item_id': item_id, 'event_type': body.event_type, 'rating': body.rating, 'created_at': event['created_at']}

@app.get('/api/v1/interactions/state/{item_id}')
async def interaction_state(item_id: UUID, user=Depends(current_user)):
    await find_project(item_id)
    last = await db.interactions.find_one({'user_id': user['_id'], 'item_id': str(item_id), 'event_type': {'$in': ['SAVE', 'UNSAVE']}}, sort=[('created_at', -1), ('_id', -1)])
    return {'saved': bool(last and last['event_type'] == 'SAVE')}

@app.get('/api/v1/interactions/me')
async def history(item_id: Optional[UUID] = None, event_type: Optional[str] = None, page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), user=Depends(current_user)):
    filters = {'user_id': user['_id']}
    if item_id: filters['item_id'] = str(item_id)
    if event_type: filters['event_type'] = event_type
    total = await db.interactions.count_documents(filters)
    items = await db.interactions.find(filters).sort([('created_at', -1), ('_id', -1)]).skip((page-1)*limit).limit(limit).to_list(limit)
    return {'items': [{**{k: v for k, v in item.items() if k not in ('_id', 'schema_version', 'user_id')}, 'id': item['_id']} for item in items], 'total': total, 'page': page, 'limit': limit, 'pages': max(1, math.ceil(total/limit))}
