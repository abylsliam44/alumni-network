"""Integration smoke tests against a dedicated running academic test database.

Start an academic backend with MONGODB_DATABASE=alumni_academic_test on port 8001.
"""
import concurrent.futures
import http.cookiejar
import json
import os
import unittest
import urllib.error
import urllib.parse
import urllib.request
import uuid

from pymongo import MongoClient

BASE = os.environ.get('ACADEMIC_TEST_URL', 'http://127.0.0.1:8001/api/v1')

class Api:
    def __init__(self):
        self.client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self, path, data=None, form=False, method=None):
        encoded = None if data is None else (urllib.parse.urlencode(data).encode() if form else json.dumps(data).encode())
        request = urllib.request.Request(BASE + path, data=encoded, method=method, headers={'Content-Type': 'application/x-www-form-urlencoded' if form else 'application/json'})
        try:
            with self.client.open(request, timeout=10) as response:
                body = response.read()
                return response.status, json.loads(body) if body else None
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

class AcademicIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dbclient = MongoClient(os.environ['MONGODB_URI'])
        cls.db = cls.dbclient['alumni_academic_test']
        cls.owner, cls.student = Api(), Api()
        suffix = uuid.uuid4().hex
        for client, name in [(cls.owner, 'owner'), (cls.student, 'student')]:
            status, _ = client.call('/auth/register', {'email': f'{name}{suffix}@example.com', 'name': name, 'password': 'StrongPass123!', 'role': 'STUDENT'})
            assert status == 201, status
        status, cls.project = cls.owner.call('/projects', {'title': 'Test project', 'short_description': 'A real integration test', 'full_description': 'A real integration test for MongoDB transactions.', 'category': 'AI_ML', 'project_stage': 'MVP', 'required_skills': ['Python']})
        assert status == 201, status

    def test_interaction_idempotency(self):
        event = {'event_id': str(uuid.uuid4()), 'item_id': self.project['id'], 'event_type': 'SAVE'}
        self.assertEqual(self.student.call('/interactions', event)[0], 201)
        self.assertEqual(self.student.call('/interactions', event)[0], 200)
        self.assertEqual(self.student.call('/interactions', {**event, 'event_type': 'UNSAVE'})[0], 409)
        self.assertEqual(self.db.interactions.count_documents({'_id': event['event_id']}), 1)

    def test_concurrent_applications(self):
        def apply(_):
            return self.student.call('/projects/' + self.project['id'] + '/apply', {'message': 'I would like to join this project.'})[0]
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            statuses = sorted(executor.map(apply, range(2)))
        self.assertEqual(statuses, [201, 409])
        self.assertEqual(self.db.project_applications.count_documents({'project_id': self.project['id']}), 1)
        self.assertEqual(self.db.interactions.count_documents({'item_id': self.project['id'], 'event_type': 'APPLY'}), 1)

    def test_foreign_update_is_forbidden(self):
        status, _ = self.student.call('/projects/' + self.project['id'], {'title': 'Stolen'}, method='PUT')
        self.assertEqual(status, 403)

if __name__ == '__main__':
    unittest.main()
