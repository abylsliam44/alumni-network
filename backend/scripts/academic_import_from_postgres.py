"""Offline, read-only PostgreSQL export into a dedicated academic MongoDB.

Dry run is the default. Set SOURCE_DATABASE_URL in the environment; never log it.
"""
import argparse
import hashlib
import json
import os
import uuid
from collections import Counter
from datetime import datetime, timezone

import psycopg2
from psycopg2.extras import RealDictCursor
from pymongo import MongoClient

from app.domain.project_enums import ProjectApplicationStatus, ProjectCategory, ProjectStage
from app.academic.schemas import Project, Application, ProfileUpdate
from pydantic import EmailStr, TypeAdapter, ValidationError

parser = argparse.ArgumentParser()
parser.add_argument('--execute', action='store_true', help='Write after validation; default is dry run')
args = parser.parse_args()
source_url = os.environ['SOURCE_DATABASE_URL']
database_name = os.environ.get('MONGODB_DATABASE', 'alumni_academic')
if database_name != 'alumni_academic':
    raise SystemExit('Import is restricted to alumni_academic')
source = psycopg2.connect(source_url)
source.set_session(readonly=True, isolation_level='REPEATABLE READ', autocommit=False)
parsed = psycopg2.extensions.parse_dsn(source_url)
fingerprint = hashlib.sha256(('|'.join(parsed.get(k, '') for k in ('host', 'port', 'dbname'))).encode()).hexdigest()
mongo = MongoClient(os.environ['MONGODB_URI'], tz_aware=True, tzinfo=timezone.utc)
db = mongo[database_name]

def fetch(table):
    # Table names are fixed literals in this script, not user input.
    with source.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute('SELECT * FROM ' + table)
        return [dict(x) for x in cursor]

def utc(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    value = value.astimezone(timezone.utc)
    return value.replace(microsecond=(value.microsecond // 1000) * 1000)

def clean(values):
    result, seen = [], set()
    for item in values or []:
        if not isinstance(item, str):
            continue
        item = ' '.join(item.split())
        if item and item.casefold() not in seen:
            result.append(item)
            seen.add(item.casefold())
    return result

def interests(value):
    # Legacy JSON object: collect string values and string elements from lists.
    if isinstance(value, dict):
        values = []
        for v in value.values():
            if isinstance(v, str): values.append(v)
            elif isinstance(v, list): values.extend(v)
        return clean(values)
    return clean(value if isinstance(value, list) else [])

def sid(value): return str(value)

def main():
    raw_users = fetch('users')
    profiles = {sid(x['user_id']): x for x in fetch('user_profiles')}
    raw_projects = fetch('projects')
    raw_apps = fetch('project_applications')
    counts = Counter()
    users, projects, applications, events = [], [], [], []
    errors = []
    email_owners = {}
    for row in raw_users:
        if row['role'] not in ('STUDENT', 'ALUMNI'):
            counts['excluded_users_role'] += 1
            continue
        identifier, email = sid(row['id']), row['email'].strip().lower()
        email_owners.setdefault(email, []).append(identifier)
        p = profiles.get(identifier, {})
        skills = clean(p.get('skills'))
        profile = {k: p.get(k) for k in ('headline', 'education', 'experience', 'location', 'graduation_year', 'linkedin_url', 'github_url', 'website_url')}
        profile.update(skills=skills, skills_normalized=[s.casefold() for s in skills], career_interests=interests(p.get('career_interests')), preferred_project_categories=[])
        try:
            TypeAdapter(EmailStr).validate_python(email)
            ProfileUpdate.model_validate({'name': row['name'], 'bio': row.get('bio'), **{k: v for k, v in profile.items() if k != 'skills_normalized'}})
            if not row['hashed_password'] or not row['created_at']:
                raise ValueError('missing required user data')
        except (ValidationError, ValueError, TypeError):
            errors.append({'invalid_user': identifier})
            continue
        users.append({'_id': identifier, 'email': row['email'], 'email_normalized': email, 'hashed_password': row['hashed_password'], 'name': row['name'], 'role': row['role'], 'is_active': row['is_active'], 'is_admin': row['is_admin'], 'photo_url': row.get('photo_url'), 'bio': row.get('bio'), 'profile': profile, 'created_at': utc(row['created_at']), 'updated_at': utc(row.get('updated_at')), 'schema_version': 1})
    for ids in email_owners.values():
        if len(ids) > 1: errors.append({'conflicting_email_user_ids': ids})
    user_ids = {u['_id'] for u in users}
    for row in raw_projects:
        if sid(row['created_by_user_id']) not in user_ids:
            counts['excluded_projects_creator'] += 1
            continue
        if row['category'] not in [x.value for x in ProjectCategory] or row['project_stage'] not in [x.value for x in ProjectStage]:
            errors.append({'unknown_project_enum': sid(row['id'])})
            continue
        fields = ('title', 'short_description', 'full_description', 'category', 'required_roles', 'project_stage', 'team_size', 'is_remote', 'contact_preference', 'github_link', 'demo_link', 'university_related', 'startup_idea', 'looking_for_cofounder')
        project = {k: row.get(k) for k in fields}
        project.update(_id=sid(row['id']), created_by_user_id=sid(row['created_by_user_id']), created_at=utc(row['created_at']), updated_at=utc(row.get('updated_at')), deleted_at=None, schema_version=1)
        for field in ('required_skills', 'tags'):
            project[field] = clean(row.get(field))
            project[field + '_normalized'] = [x.casefold() for x in project[field]]
        try:
            Project.model_validate({k: project.get(k) for k in Project.model_fields})
            if not project['created_at']:
                raise ValueError('missing created_at')
        except (ValidationError, ValueError, TypeError):
            errors.append({'invalid_project': sid(row['id'])})
            continue
        projects.append(project)
    project_ids = {p['_id'] for p in projects}
    pairs = set()
    for row in raw_apps:
        identifier, user_id, project_id = sid(row['id']), sid(row['applicant_id']), sid(row['project_id'])
        if user_id not in user_ids or project_id not in project_ids:
            counts['excluded_applications_reference'] += 1
            continue
        if row['status'] not in [x.value for x in ProjectApplicationStatus]:
            errors.append({'unknown_application_status': identifier})
            continue
        if (project_id, user_id) in pairs:
            errors.append({'duplicate_application_id': identifier})
            continue
        try:
            Application.model_validate({'message': row['message'], 'skills': clean(row.get('skills')), 'fit_reason': row.get('fit_reason')})
            if not row['applied_at']:
                raise ValueError('missing applied_at')
        except (ValidationError, ValueError, TypeError):
            errors.append({'invalid_application': identifier})
            continue
        pairs.add((project_id, user_id))
        stamp = utc(row['applied_at'])
        applications.append({'_id': identifier, 'project_id': project_id, 'applicant_id': user_id, 'message': row['message'], 'skills': clean(row.get('skills')), 'fit_reason': row.get('fit_reason'), 'status': row['status'], 'applied_at': stamp, 'schema_version': 1})
        events.append({'_id': str(uuid.uuid5(uuid.NAMESPACE_URL, 'alumni-academic:application:' + identifier)), 'user_id': user_id, 'item_id': project_id, 'item_type': 'PROJECT', 'event_type': 'APPLY', 'created_at': stamp, 'schema_version': 1})
    collections = {'users': users, 'projects': projects, 'project_applications': applications, 'interactions': events}
    marker = db.academic_migrations.find_one({'_id': 'postgres'})
    if marker and marker.get('source') != fingerprint:
        errors.append({'destination': 'different migration source'})
    if not marker and any(db[name].estimated_document_count() for name in collections):
        errors.append({'destination': 'database is not empty or marked as this import'})
    if marker:
        for name, docs in collections.items():
            for doc in docs:
                old = db[name].find_one({'_id': doc['_id']})
                if old and old != doc:
                    errors.append({'modified_document': {'collection': name, 'id': doc['_id']}})
    report = {'mode': 'execute' if args.execute else 'dry_run', 'source_counts': {'users': len(raw_users), 'projects': len(raw_projects), 'applications': len(raw_apps)}, 'eligible_counts': {k: len(v) for k, v in collections.items()}, 'skipped': dict(counts), 'errors': errors, 'naive_dates_assumed': 'UTC'}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if errors: raise SystemExit(1)
    if args.execute:
        db.academic_migrations.update_one({'_id': 'postgres'}, {'$setOnInsert': {'source': fingerprint}}, upsert=True)
        for name, docs in collections.items():
            for doc in docs:
                db[name].update_one({'_id': doc['_id']}, {'$setOnInsert': doc}, upsert=True)
    source.rollback()
    source.close()
    mongo.close()

if __name__ == '__main__': main()
