import os
from datetime import timezone
from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient(os.environ.get("MONGODB_URI", "mongodb://localhost:27017/?replicaSet=rs0"), tz_aware=True, tzinfo=timezone.utc, serverSelectionTimeoutMS=3000)
db = client[os.environ.get("MONGODB_DATABASE", "alumni_academic")]

async def create_validators():
    from app.domain.project_enums import ProjectCategory, ProjectRole, ProjectStage, ProjectApplicationStatus
    definitions = {
        'users': ({'_id': {'bsonType': 'string'}, 'email_normalized': {'bsonType': 'string'}, 'hashed_password': {'bsonType': 'string'}, 'name': {'bsonType': 'string'}, 'role': {'enum': ['STUDENT', 'ALUMNI']}, 'is_active': {'bsonType': 'bool'}, 'is_admin': {'bsonType': 'bool'}, 'profile': {'bsonType': 'object'}, 'created_at': {'bsonType': 'date'}, 'schema_version': {'enum': [1]}}, ['_id', 'email_normalized', 'hashed_password', 'name', 'role', 'is_active', 'is_admin', 'profile', 'created_at', 'schema_version']),
        'projects': ({'_id': {'bsonType': 'string'}, 'title': {'bsonType': 'string'}, 'category': {'enum': [x.value for x in ProjectCategory]}, 'project_stage': {'enum': [x.value for x in ProjectStage]}, 'required_roles': {'bsonType': 'array', 'items': {'enum': [x.value for x in ProjectRole]}}, 'required_skills': {'bsonType': 'array'}, 'created_by_user_id': {'bsonType': 'string'}, 'created_at': {'bsonType': 'date'}, 'deleted_at': {'bsonType': ['date', 'null']}, 'schema_version': {'enum': [1]}}, ['_id', 'title', 'category', 'project_stage', 'required_roles', 'required_skills', 'created_by_user_id', 'created_at', 'deleted_at', 'schema_version']),
        'project_applications': ({'_id': {'bsonType': 'string'}, 'project_id': {'bsonType': 'string'}, 'applicant_id': {'bsonType': 'string'}, 'status': {'enum': [x.value for x in ProjectApplicationStatus]}, 'applied_at': {'bsonType': 'date'}, 'schema_version': {'enum': [1]}}, ['_id', 'project_id', 'applicant_id', 'status', 'applied_at', 'schema_version']),
        'interactions': ({'_id': {'bsonType': 'string'}, 'user_id': {'bsonType': 'string'}, 'item_id': {'bsonType': 'string'}, 'item_type': {'enum': ['PROJECT']}, 'event_type': {'enum': ['VIEW', 'SAVE', 'UNSAVE', 'RATE', 'APPLY']}, 'created_at': {'bsonType': 'date'}, 'schema_version': {'enum': [1]}}, ['_id', 'user_id', 'item_id', 'item_type', 'event_type', 'created_at', 'schema_version']),
    }
    existing = await db.list_collection_names()
    for name, (properties, required) in definitions.items():
        validator = {'$jsonSchema': {'bsonType': 'object', 'required': required, 'properties': properties}}
        if name in existing:
            await db.command('collMod', name, validator=validator, validationLevel='strict')
        else:
            await db.create_collection(name, validator=validator)

async def create_indexes():
    await create_validators()
    await db.users.create_index("email_normalized", unique=True)
    await db.users.create_index([("role", 1), ("profile.location", 1)])
    await db.users.create_index("profile.skills_normalized")
    await db.projects.create_index([("deleted_at", 1), ("created_at", -1), ("_id", 1)])
    await db.projects.create_index([("deleted_at", 1), ("category", 1), ("created_at", -1), ("_id", 1)])
    await db.projects.create_index([("created_by_user_id", 1), ("deleted_at", 1), ("created_at", -1)])
    await db.projects.create_index([("required_skills_normalized", 1), ("deleted_at", 1)])
    await db.projects.create_index([("required_roles", 1), ("deleted_at", 1)])
    await db.projects.create_index([("title", "text"), ("short_description", "text"), ("full_description", "text")], default_language="none")
    await db.project_applications.create_index([("project_id", 1), ("applicant_id", 1)], unique=True)
    await db.project_applications.create_index([("applicant_id", 1), ("applied_at", -1)])
    await db.project_applications.create_index([("project_id", 1), ("applied_at", -1)])
    await db.interactions.create_index([("user_id", 1), ("created_at", -1), ("_id", -1)])
    await db.interactions.create_index([("user_id", 1), ("item_id", 1), ("event_type", 1), ("created_at", -1), ("_id", -1)])
