"""Synthetic MongoDB query benchmark. Only touches alumni_academic_benchmark."""
import argparse
import json
import os
import platform
import statistics
import time
import uuid
from datetime import datetime, timedelta, timezone

from pymongo import MongoClient
from app.academic.main import score_stages

parser = argparse.ArgumentParser()
parser.add_argument('--prepare', action='store_true', help='Populate the dedicated benchmark DB if empty')
args = parser.parse_args()
client = MongoClient(os.environ['MONGODB_URI'])
db = client['alumni_academic_benchmark']

if args.prepare:
    if any(db[name].estimated_document_count() for name in ('users', 'projects', 'interactions', 'project_applications')):
        raise SystemExit('Benchmark DB is not empty; refusing to overwrite')
    timestamp = datetime(2025, 1, 1, tzinfo=timezone.utc)
    ids = [str(uuid.uuid5(uuid.NAMESPACE_URL, f'benchmark:user:{i}')) for i in range(1000)]
    db.users.insert_many([{'_id': identifier, 'email_normalized': f'bench{i}@example.test'} for i, identifier in enumerate(ids)])
    db.projects.insert_many([{'_id': str(uuid.uuid5(uuid.NAMESPACE_URL, f'benchmark:project:{i}')), 'deleted_at': None, 'created_at': timestamp + timedelta(minutes=i), 'category': 'AI_ML' if i % 10 == 0 else 'STARTUP', 'required_skills_normalized': ['python', 'fastapi'] if i % 4 == 0 else ['design'], 'tags_normalized': ['education']} for i in range(10000)])
    for start in range(0, 100000, 10000):
        db.interactions.insert_many([{'_id': str(uuid.uuid5(uuid.NAMESPACE_URL, f'benchmark:event:{i}')), 'user_id': ids[i % 1000], 'created_at': timestamp + timedelta(seconds=i), 'event_type': 'VIEW'} for i in range(start, start + 10000)])
if [db.users.count_documents({}), db.projects.count_documents({}), db.interactions.count_documents({})] != [1000, 10000, 100000]:
    raise SystemExit('Run --prepare against an empty benchmark DB first')
# Preserve uniqueness constraints across the comparison.
db.users.create_index('email_normalized', unique=True)
db.project_applications.create_index([('project_id', 1), ('applicant_id', 1)], unique=True)
user_id = str(uuid.uuid5(uuid.NAMESPACE_URL, 'benchmark:user:0'))
user = {'profile': {'skills_normalized': ['python', 'fastapi'], 'career_interests': ['education'], 'preferred_project_categories': ['AI_ML']}}
queries = {
    'catalog': lambda: list(db.projects.find({'deleted_at': None}).sort([('created_at', -1), ('_id', 1)]).limit(20)),
    'category': lambda: list(db.projects.find({'deleted_at': None, 'category': 'AI_ML'}).sort([('created_at', -1), ('_id', 1)]).limit(20)),
    'skills': lambda: list(db.projects.find({'deleted_at': None, 'required_skills_normalized': {'$all': ['python']}}).limit(20)),
    'history': lambda: list(db.interactions.find({'user_id': user_id}).sort([('created_at', -1), ('_id', -1)]).limit(20)),
    'recommendations': lambda: list(db.projects.aggregate([{'$match': {'deleted_at': None}}] + score_stages(user) + [{'$sort': {'match_score': -1, 'created_at': -1, '_id': 1}}, {'$limit': 20}])),
}

def explain(collection, query):
    data = db.command('explain', query, verbosity='executionStats')
    stats = data['executionStats']
    return {'winningPlan': data['queryPlanner']['winningPlan'], 'nReturned': stats['nReturned'], 'totalDocsExamined': stats['totalDocsExamined'], 'totalKeysExamined': stats['totalKeysExamined']}

def measure():
    results = {}
    for name, fn in queries.items():
        for _ in range(10): fn()
        values = []
        for _ in range(100):
            start = time.perf_counter(); fn(); values.append((time.perf_counter() - start) * 1000)
        values.sort()
        results[name] = {'p95_ms': round(values[94], 2), 'median_ms': round(statistics.median(values), 2), 'runs': 100, 'warmup': 10}
    pipeline = [{'$match': {'deleted_at': None}}] + score_stages(user) + [{'$sort': {'match_score': -1, 'created_at': -1, '_id': 1}}, {'$limit': 20}]
    aggregation = db.command('explain', {'aggregate': 'projects', 'pipeline': pipeline, 'cursor': {}}, verbosity='executionStats')
    results['explain_recommendations'] = aggregation
    results['explain_catalog'] = explain('projects', {'find': 'projects', 'filter': {'deleted_at': None}, 'sort': {'created_at': -1, '_id': 1}, 'limit': 20})
    results['explain_history'] = explain('interactions', {'find': 'interactions', 'filter': {'user_id': user_id}, 'sort': {'created_at': -1, '_id': -1}, 'limit': 20})
    return results

# No user collections are modified; only secondary indexes on the benchmark copy.
for name in ('projects', 'interactions'):
    db[name].drop_indexes()
report = {'environment': {'platform': platform.platform(), 'python': platform.python_version(), 'mongo': client.server_info()['version'], 'projects': 10000, 'users': 1000, 'interactions': 100000, 'measurement': 'synchronous driver queries within backend container; excludes HTTP and UI'}, 'before_indexes': measure()}
db.projects.create_index([('deleted_at', 1), ('created_at', -1), ('_id', 1)])
db.projects.create_index([('deleted_at', 1), ('category', 1), ('created_at', -1), ('_id', 1)])
db.projects.create_index([('required_skills_normalized', 1), ('deleted_at', 1)])
db.interactions.create_index([('user_id', 1), ('created_at', -1), ('_id', -1)])
report['after_indexes'] = measure()
print(json.dumps(report, indent=2, default=str))
