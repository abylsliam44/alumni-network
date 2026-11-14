"""End-to-end checks against the explicitly enabled isolated integrated demo."""
import http.cookiejar
import json
import os
import unittest
import urllib.error
import urllib.parse
import urllib.request
import uuid

from pymongo import MongoClient

BASE = os.environ.get('INTEGRATED_TEST_BASE', 'http://127.0.0.1:8000/api/v1')


class Client:
    def __init__(self):
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self, method, path, payload=None, form=False):
        data = None if payload is None else (urllib.parse.urlencode(payload).encode() if form else json.dumps(payload).encode())
        request = urllib.request.Request(BASE + path, data=data, method=method,
            headers={'Content-Type': 'application/x-www-form-urlencoded' if form else 'application/json'})
        try:
            with self.opener.open(request, timeout=30) as response:
                raw = response.read()
                return response.status, json.loads(raw) if raw else None
        except urllib.error.HTTPError as error:
            raw = error.read()
            return error.code, json.loads(raw) if raw else None


class IntegratedProjectsTest(unittest.TestCase):
    def test_full_platform_session_and_mongo_projects(self):
        if os.getenv('INTEGRATED_PROJECTS_MODE') != 'true' or os.getenv('INTEGRATED_DEMO_SEED') != 'true' or os.getenv('MONGODB_DATABASE') != 'alumni_integrated':
            self.skipTest('Requires the explicitly enabled isolated integrated demo')
        mongo = MongoClient(os.environ['MONGODB_URI'])['alumni_integrated']
        owner, applicant = Client(), Client()
        for client, email in ((owner, 'demo3@integrated.example.com'), (applicant, 'demo2@integrated.example.com')):
            status, _ = client.call('POST', '/auth/login', {'username': email, 'password': 'DemoPass123!'}, form=True)
            self.assertEqual(status, 200)
        status, current = applicant.call('GET', '/auth/me')
        self.assertEqual(status, 200)
        user_id = str(current['id'])
        self.assertEqual(applicant.call('GET', '/directory/?limit=2')[0], 200)
        self.assertEqual(applicant.call('GET', '/jobs/')[0], 200)
        self.assertEqual(applicant.call('GET', '/projects/recommended?limit=2')[0], 200)
        mongo_user = mongo.users.find_one({'_id': user_id})
        self.assertIsNotNone(mongo_user)
        self.assertEqual(mongo_user['hashed_password'], '!')
        self.assertEqual(mongo_user['profile']['skills_normalized'], ['python', 'react'])
        title = 'Integration test ' + uuid.uuid4().hex
        project_id = None
        try:
            status, project = owner.call('POST', '/projects', {
                'title': title, 'short_description': 'A synthetic test project.',
                'full_description': 'This project tests the unified platform with MongoDB.',
                'category': 'AI_ML', 'project_stage': 'MVP', 'required_skills': ['Python'],
            })
            self.assertEqual(status, 201, project)
            project_id = str(project['id'])
            self.assertIsNotNone(mongo.projects.find_one({'_id': project_id, 'title': title}))
            event = {'event_id': str(uuid.uuid4()), 'item_id': project_id, 'event_type': 'SAVE'}
            self.assertEqual(applicant.call('POST', '/interactions', event)[0], 201)
            self.assertEqual(applicant.call('POST', '/interactions', event)[0], 200)
            status, state = applicant.call('GET', '/interactions/state/' + project_id)
            self.assertEqual((status, state['saved']), (200, True))
            status, _ = applicant.call('POST', '/projects/' + project_id + '/apply', {'message': 'I want to help with this project.'})
            self.assertEqual(status, 201)
            self.assertEqual(applicant.call('POST', '/projects/' + project_id + '/apply', {'message': 'I want to help with this project.'})[0], 409)
            self.assertEqual(mongo.project_applications.count_documents({'project_id': project_id, 'applicant_id': user_id}), 1)
            self.assertEqual(mongo.interactions.count_documents({'item_id': project_id, 'user_id': user_id, 'event_type': 'APPLY'}), 1)
            status, recommendations = applicant.call('GET', '/projects/recommended?limit=30')
            self.assertEqual(status, 200)
            self.assertNotIn(project_id, [p['id'] for p in recommendations['items']])
        finally:
            # Delete only this test's uniquely named project and its associated test records.
            if project_id and mongo.projects.find_one({'_id': project_id, 'title': title}):
                mongo.interactions.delete_many({'item_id': project_id})
                mongo.project_applications.delete_many({'project_id': project_id})
                mongo.projects.delete_one({'_id': project_id, 'title': title})
            mongo.client.close()


if __name__ == '__main__':
    unittest.main()
