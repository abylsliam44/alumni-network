# Alumni Social Network Technical Documentation

This document describes the actual architecture and feature set of the current codebase. The project is a full-stack community platform for AITU students, alumni, mentors, university staff, HR partners, and administrators. It combines professional profiles, networking, mentorship, jobs, projects, events, real-time messaging, video calls, resume import, AI chat, people recommendations, and career opportunity roadmaps.

## Table of Contents

- [System Purpose](#system-purpose)
- [High-Level Architecture](#high-level-architecture)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Roles and Permissions](#roles-and-permissions)
- [Backend](#backend)
- [Frontend](#frontend)
- [Data Model](#data-model)
- [Feature Reference](#feature-reference)
- [API Map](#api-map)
- [WebSocket Protocols](#websocket-protocols)
- [Background Jobs](#background-jobs)
- [Caching and Invalidation](#caching-and-invalidation)
- [File Storage](#file-storage)
- [Security](#security)
- [Environment Configuration](#environment-configuration)
- [Run, Migrations, and Deployment](#run-migrations-and-deployment)
- [Testing and Quality](#testing-and-quality)
- [Current Limitations](#current-limitations)

## System Purpose

Alumni Social Network solves several connected product and technical problems:

- maintain a professional AITU community profile;
- discover people by role, skills, location, graduation year, and mentor status;
- build a network through connection/friend requests;
- manage mentorship relationships with requests, plans, milestones, sessions, and feedback;
- publish and moderate jobs;
- apply to jobs with resumes, status tracking, interviews, and application chat;
- publish projects and find teammates by skill match;
- create events with approval flow, registrations, waitlists, materials, speakers, reviews, and event chat;
- send direct messages between friends or mentorship participants;
- run video calls through Jitsi/JaaS;
- import resumes, extract career data, confirm it with the user, and build a career graph;
- provide an AITU-focused AI chat with RAG over a knowledge base;
- recommend people through embeddings and Qdrant;
- generate career opportunity roadmaps from confirmed alumni career data.

The system is split into a React SPA, a FastAPI backend, PostgreSQL, Redis, Celery, Qdrant, and MinIO. Development and production have separate Docker Compose configurations.

## High-Level Architecture

```mermaid
flowchart TB
    Browser["React SPA"]
    Nginx["Vite dev proxy / Nginx production"]
    API["FastAPI backend"]
    WS["WebSockets"]
    PG[("PostgreSQL")]
    RedisCache[("Redis cache/pubsub/rate-limit")]
    RedisCelery[("Redis Celery")]
    Worker["Celery worker"]
    Beat["Celery beat"]
    Qdrant[("Qdrant")]
    MinIO[("MinIO")]
    AI["OpenAI / Gemini / sentence-transformers"]
    SMTP["SMTP"]
    Jitsi["Jitsi / JaaS"]

    Browser --> Nginx
    Nginx --> API
    Nginx --> WS
    API --> PG
    API --> RedisCache
    API --> RedisCelery
    API --> Qdrant
    API --> MinIO
    API --> AI
    API --> SMTP
    API --> Jitsi
    RedisCelery --> Worker
    RedisCelery --> Beat
    Worker --> PG
    Worker --> Qdrant
    Worker --> MinIO
```

Main backend entrypoint: `backend/app/main.py`.

Main frontend entrypoint: `frontend/src/App.jsx`.

The REST API is versioned under `/api/v1`. The health endpoint is exposed separately at `/api/health`. The primary chat WebSocket endpoint is `/ws/chat`, while job application chat uses `/api/v1/job-chat/ws/{application_id}`.

## Technology Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 18, Vite 5, React Router 6, Axios, Framer Motion, CSS |
| Backend | Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2 async, Alembic |
| Database | PostgreSQL 16 |
| Cache and realtime coordination | Redis 7 for cache, pub/sub, and rate limits |
| Queues | Celery 5 with Redis broker/result backend |
| Vector search | Qdrant 1.9 |
| File storage | MinIO S3-compatible storage, plus legacy local `/static` files for avatar/cover uploads |
| AI | OpenAI SDK, Google Generative AI, LangChain, sentence-transformers |
| Document processing | PyMuPDF, python-docx, Pillow, Tesseract OCR with English and Russian language packs |
| Infrastructure | Docker, Docker Compose, Nginx, GitHub Actions |

## Repository Structure

```text
.
|-- backend/
|   |-- app/
|   |   |-- api/
|   |   |   |-- ws.py                    # primary direct-message WebSocket
|   |   |   `-- v1/
|   |   |       |-- router.py             # registers all REST endpoint modules
|   |   |       `-- endpoints/            # REST endpoints by domain
|   |   |-- ai/                           # people recommendations and RAG
|   |   |-- core/                         # config, DB, cache, storage, security
|   |   |-- models/                       # SQLAlchemy models
|   |   |-- schemas/                      # Pydantic schemas
|   |   |-- services/                     # domain services
|   |   `-- tasks/                        # Celery tasks
|   |-- alembic/                          # database migrations
|   |-- tests/                            # backend smoke tests
|   |-- Dockerfile
|   `-- Dockerfile.prod
|-- frontend/
|   |-- src/
|   |   |-- api/                          # thin clients for backend endpoints
|   |   |-- components/                   # shell, shared UI, feature components
|   |   |-- context/                      # AuthContext, ThemeContext
|   |   |-- hooks/                        # useAuth, useChatSocket
|   |   |-- pages/                        # route-level screens
|   |   `-- utils/                        # helpers
|   |-- nginx.conf                        # production reverse proxy
|   |-- Dockerfile
|   `-- Dockerfile.prod
|-- docs/
|   |-- TECHNICAL_DOCUMENTATION.md
|   `-- assets/
|-- docker-compose.yml                    # local development
|-- docker-compose.prod.yml               # production
|-- .env.example
`-- .github/workflows/deploy.yml
```

## Roles and Permissions

### Primary User Roles

The `UserRole` enum is defined in `backend/app/models/user.py`.

| Role | Value | Main purpose |
| --- | --- | --- |
| Student | `STUDENT` | profile, mentor discovery, job applications, projects, events, messaging |
| Alumni | `ALUMNI` | all base capabilities, mentorship, job posting |
| Staff | `STAFF` | university staff, event and job moderation |
| HR | `HR` | hiring partner; receives `JOB_POSTER` system role on registration |

### Additional Capability Flags

| Field | Stored in | Meaning |
| --- | --- | --- |
| `is_mentor` | `users` | user enabled mentor mode through `/mentorship/become` |
| `is_admin` | `users` | full administrative access; not assigned by regular registration |
| `is_active` | `users` | inactive users fail auth guards |
| `is_verified` | `users` | verification flag displayed in profile |
| `system_roles` | `users` ARRAY | system capabilities such as `JOB_APPLICANT`, `JOB_POSTER`, `JOB_MODERATOR` |

### Job Permissions

A user can create jobs when one of the following is true:

- `is_admin = true`;
- role is `ALUMNI`;
- role is `HR`;
- `system_roles` contains `JOB_POSTER` or `HR`.

A user can moderate jobs when one of the following is true:

- `is_admin = true`;
- role is `STAFF`;
- `system_roles` contains `JOB_MODERATOR`.

### Event Permissions

Any authenticated active user can create an event. Pending events can be approved or rejected by users with `is_admin = true` or role `STAFF`.

### Messaging Permissions

Direct messages are allowed only when users are:

- friends through an accepted connection; or
- participants in a mentorship relationship with status `ACTIVE` or `COMPLETED`.

This rule is enforced in REST message endpoints, `/ws/chat`, and video room creation.

## Backend

### Application Initialization

`backend/app/main.py` creates the FastAPI application:

- sets OpenAPI URL `/api/v1/openapi.json`, `/docs`, and `/redoc` when `ENABLE_OPENAPI=true`;
- mounts `/static` to `UPLOAD_DIR` for legacy avatar/cover uploads;
- adds CORS middleware;
- adds Redis-backed rate limit middleware;
- adds a CSRF-style Origin guard for mutating HTTP methods;
- registers the REST router with prefix `/api/v1`;
- registers the WebSocket router;
- starts a Redis pub/sub listener during lifespan startup so WebSocket broadcasts work across multiple uvicorn workers;
- closes Redis clients during shutdown.

### Database Layer

`backend/app/core/database.py`:

- converts `postgresql://` to `postgresql+asyncpg://`;
- creates an async SQLAlchemy engine with `pool_pre_ping`, `pool_size`, `max_overflow`, `pool_timeout`, and `pool_recycle`;
- creates `AsyncSessionLocal` for API requests;
- creates a separate `TaskSessionLocal` with `NullPool` for Celery tasks, because tasks call `asyncio.run()` and should not reuse asyncpg connections across event loops.

### Configuration

`backend/app/core/config.py` uses Pydantic Settings and `.env`. Main configuration groups:

- database: `DATABASE_URL` and pool settings;
- security: JWT secret, token TTLs, cookie names/flags, OpenAPI toggle;
- Redis/Celery: cache, pub/sub, rate-limit, broker, result URLs;
- cache TTLs;
- rate limits;
- AI/vector search;
- CORS;
- Jitsi/JaaS;
- local uploads and MinIO;
- resume worker polling;
- SMTP.

### REST Routing

`backend/app/api/v1/router.py` registers these domains:

| Prefix | Module |
| --- | --- |
| `/auth` | login, registration, current user, refresh, logout |
| `/profile` | current and public profiles, photo/cover |
| `/directory` | user search |
| `/connections` | friend requests and friends |
| `/mentorship` | mentor onboarding, requests, relationships, plans, sessions, feedback |
| `/jobs` | job board, applications, interviews, resume downloads |
| `/job-chat` | application chat for job applications |
| `/projects` | project board, applications, candidate suggestions |
| `/events` | events, moderation, registrations, reviews, materials, speakers, chat |
| `/messages` | direct messages, attachments |
| `/notifications` | notification list and read state |
| `/resumes` | resume import pipeline |
| `/recommendations` | people recommendations and admin reindex |
| `/opportunities` | career opportunity roadmap |
| `/ai` | AI chat and knowledge base |
| `/videocall` | Jitsi/JaaS configuration and room creation |

### Authentication

Authentication lives in `backend/app/api/v1/endpoints/auth.py`.

Key behavior:

- login uses `OAuth2PasswordRequestForm`, so the frontend sends `username=email` and `password` as form data;
- access and refresh tokens are JWTs;
- tokens are stored in HttpOnly cookies, named `access_token` and `refresh_token` by default;
- response bodies intentionally do not return raw tokens, only `token_type`;
- the refresh endpoint reads the refresh cookie, validates `type=refresh`, and issues a new access and refresh token;
- logout removes both cookies;
- the current user is available through `/api/v1/auth/me`.

Password strength is enforced on registration:

- at least 8 characters;
- at least one uppercase letter;
- at least one lowercase letter;
- at least one number;
- at least one special character from `!@#$%^&*(),.?":{}|<>`.

### Dependency Guards

`backend/app/api/deps.py` provides:

- `get_current_user`;
- `get_current_active_user`;
- `get_current_user_optional`;
- `require_roles`;
- `require_admin`;
- `get_user_from_token` for WebSocket/application chat.

Tokens are read from either the Bearer header or the auth cookie.

### Rate Limiting

The middleware in `main.py` uses Redis from `REDIS_RATE_LIMIT_URL`.

| Bucket | Condition | Default limit | Identifier | Failure policy |
| --- | --- | --- | --- | --- |
| `auth` | `/auth/login`, `/auth/register`, `/auth/refresh` | `10/min` | IP | fail closed |
| `ai` | `/ai`, `/recommendations`, `/opportunities` | `20/min` | user or IP fallback | fail open |
| `messages` | `POST /messages...` | `60/min` | user or IP fallback | fail open |
| `api` | other `/api/v1` paths | `180/min` | user or IP fallback | fail open |

When the limit is exceeded, the backend returns `429` with a `Retry-After` header. If the auth rate limiter is unavailable, it returns `503`.

### CSRF and Origin Checks

For `POST`, `PUT`, `PATCH`, and `DELETE`, the backend validates the `Origin` header through `app.core.origins.is_allowed_origin`. Empty Origin is allowed. Configured origins come from `BACKEND_CORS_ORIGINS`; local development fallback includes localhost/frontend/backend origins.

WebSocket endpoints also validate origin.

## Frontend

### Router

`frontend/src/App.jsx` defines the application routes:

| Route | Screen | Access |
| --- | --- | --- |
| `/` | Landing | public |
| `/login` | Login | public |
| `/register` | Register | public |
| `/forgot-password` | ForgotPassword static page | public |
| `/dashboard` | Dashboard | protected |
| `/feed` | Feed placeholder | protected |
| `/directory` | Directory/Mentors | protected |
| `/mentorship` | Mentorship workspace | protected |
| `/become-mentor` | Mentor onboarding | protected |
| `/jobs` | Job board | protected shell; API can expose approved jobs publicly |
| `/jobs/create` | Create job | protected; backend checks poster rights |
| `/jobs/:jobId` | Job detail | protected |
| `/jobs/hiring` | Hiring dashboard | protected; shown to posters/moderators |
| `/jobs/applications` | My applications | protected |
| `/projects` | Project board | protected |
| `/projects/create` | Create project | protected |
| `/projects/edit/:projectId` | Edit project | protected; owner/admin on backend |
| `/projects/:projectId` | Project detail | protected |
| `/events` | Events list | protected |
| `/events/create` | Create event | protected |
| `/events/:eventId` | Event detail | protected |
| `/events/admin` | Pending events | protected; staff/admin on backend |
| `/messages` | Direct messages | protected |
| `/video-call/:roomName` | Jitsi room wrapper | protected |
| `/friends` | Connections/friends | protected |
| `/recommendations` | People recommendations | protected |
| `/opportunities` | Opportunity roadmap | protected; hidden for admin/staff |
| `/ai` | AqyldyAI chat | protected |
| `/profile` | Own profile | protected |
| `/profile/edit` | Edit profile | protected |
| `/profile/resume-import` | Resume import | protected |
| `/profile/:userId` | Public profile | protected |
| `/settings` | Settings/theme/account display | protected |

### AppShell

`frontend/src/components/AppShell.jsx`:

- renders the vertical icon rail;
- shows primary navigation;
- shows the Hiring link only when `canPostJobs(user)` or `canModerateJobs(user)` is true;
- hides Opportunities for admin/staff;
- shows Become a Mentor only when `user.is_mentor` is false;
- includes `NotificationDropdown`;
- includes `ThemeToggle`;
- enables full-bleed content mode for messages, video calls, and AI.

### AuthContext

`frontend/src/context/AuthContext.jsx`:

- calls `/api/v1/auth/me` on app load;
- removes legacy localStorage tokens because the current auth model is cookie-based;
- after login/register, fetches the current user again;
- logout clears localStorage, resets user state, and calls backend logout.

### Axios Client

`frontend/src/api/axios.js`:

- uses `VITE_API_URL` as `baseURL` when set, otherwise an empty base URL that works through Vite/Nginx proxy;
- sets `withCredentials=true` so the browser sends auth cookies;
- on `401`, calls `/api/v1/auth/refresh`, then retries the original request;
- if refresh fails, redirects to `/login`;
- emits `app:network-error` for network-down errors so `App.jsx` can show `ErrorScreen`.

### Theme

`ThemeContext` stores `light`/`dark` in localStorage and applies `data-theme` to `documentElement`.

### Dev and Production Proxying

Vite proxy:

- `/api` -> backend;
- `/ws` -> backend WebSocket;
- `/storage` -> MinIO.

Production Nginx:

- serves the Vite build;
- proxies `/api`, `/ws`, `/static`, and `/storage`;
- separately supports `/api/v1/job-chat/ws/`;
- sets basic security headers and CSP;
- allows camera/microphone/display-capture for Jitsi domains.

## Data Model

### Users and Profiles

Tables:

- `users`;
- `user_profiles`.

`users` stores auth and identity:

- `email`, `hashed_password`, `name`;
- `photo_url`, `bio`;
- `role`;
- `is_mentor`, `is_admin`, `is_active`, `is_verified`;
- `system_roles`;
- timestamps.

`user_profiles` stores the extended profile:

- `education` JSONB;
- `skills` JSONB;
- `experience` JSONB;
- `career_interests` JSONB;
- `availability`, `location`, `graduation_year`;
- social links: LinkedIn, GitHub, website;
- `visibility_settings` JSONB;
- `headline`;
- mentor metadata: headline, areas, industries, max mentees, note, availability slots, consent;
- `cover_url`.

### Connections

`connections`:

- requester;
- recipient;
- status: `PENDING`, `ACCEPTED`, `DECLINED`;
- timestamps.

An accepted connection is considered a friendship and unlocks direct messages and video calls.

### Mentorship

Tables:

- `mentorship_requests`;
- `mentorship_relationships`;
- `mentorship_plans`;
- `mentorship_sessions`;
- `mentor_feedback`.

Main statuses:

- request: `PENDING`, `ACCEPTED`, `DECLINED`, `CANCELLED`;
- relationship: `ACTIVE`, `COMPLETED`;
- session: `PLANNED`, `DONE`, `CANCELLED`.

### Messages

Tables:

- `conversations`;
- `conversation_participants`;
- `messages`.

The MVP uses 1:1 conversations, but the participant table keeps the model flexible.

Message supports:

- text;
- attachment URL/name/mime/size;
- read state;
- system messages, for example video call invitations.

### Jobs

Tables:

- `jobs`;
- `job_applications`;
- `job_interviews`;
- `job_chat_messages`.

Job enums:

- format: `ONSITE`, `REMOTE`, `HYBRID`;
- employment type: `FULL_TIME`, `PART_TIME`, `INTERNSHIP`, `CONTRACT`;
- status: `DRAFT`, `PENDING`, `APPROVED`, `CLOSED`, `REJECTED`.

Application status:

- `SUBMITTED`, `VIEWED`, `SHORTLISTED`, `INTERVIEW`, `REJECTED`, `HIRED`.

Interview status:

- `SCHEDULED`, `COMPLETED`, `CANCELLED`.

### Projects

Tables:

- `projects`;
- `project_applications`.

Project categories:

- `STARTUP`, `PET_PROJECT`, `AI_ML`, `MOBILE_APP`, `WEB_PLATFORM`, `SAAS`, `UNIVERSITY_PROJECT`, `HACKATHON`, `RESEARCH`, `OPEN_SOURCE`.

Project roles:

- frontend, backend, fullstack, design, product, ML, mobile, DevOps, marketing, co-founder.

Project stages:

- `IDEA`, `VALIDATION`, `MVP`, `IN_PROGRESS`, `SCALING`.

### Events

Tables:

- `events`;
- `event_registrations`;
- `event_speakers`;
- `event_materials`;
- `event_reviews`;
- `event_messages`.

Event types:

- `career`, `educational`, `networking`, `recruiting`, `invite-only`.

Event formats:

- `online`, `offline`, `hybrid`.

Event statuses:

- `draft`, `pending`, `approved`, `cancelled`, `completed`.

Registration statuses:

- `REGISTERED`, `WAITLISTED`, `ATTENDED`, `CANCELLED`.

### Notifications

`notifications` stores:

- recipient `user_id`;
- `type`;
- `title`, `message`;
- read state;
- `reference_id`;
- optional `actor_id`;
- timestamps.

Notification types cover friend requests, mentorship, messages, events, mentor feedback, job applications, job interviews, and application chat.

### Resume and Career Graph

The resume import pipeline uses:

- `resume_documents`;
- `resume_import_sessions`;
- `resume_processing_jobs`;
- `resume_extraction_drafts`;
- canonical dictionaries: companies, roles, skills, faculties, programs;
- `alumni_career_profiles`;
- education/employment/skill records;
- `career_graph_nodes`;
- `career_graph_edges`.

Resume document status:

- `UPLOADED`, `PROCESSING`, `PARSED`, `FAILED`, `DELETED`.

Processing status:

- `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`.

Confirmation status:

- `DRAFT`, `NEEDS_REVIEW`, `CONFIRMED`, `ARCHIVED`.

Resume job types:

- `EXTRACT_TEXT`;
- `EXTRACT_STRUCTURED_DATA`;
- `NORMALIZE_DRAFT`;
- `SYNC_PROFILE`;
- `BUILD_GRAPH`.

In the current code, handlers are implemented for the first three job types: text extraction, structured extraction, and normalization. Sync/profile/graph work happens during confirmation through a service, not through separate Celery handlers.

### AI Chat

`ai_chat_messages` stores AI chat history:

- `user_id`;
- role `user` or `assistant`;
- `content`;
- timestamp.

Qdrant collections:

- `users` for people recommendations;
- `aitu_knowledge_base` for RAG knowledge base.

## Feature Reference

### 1. Landing, Login, and Registration

Frontend:

- `Landing.jsx` is the public landing page;
- `Login.jsx` is the email/password form;
- `Register.jsx` creates an account with a role;
- `ForgotPassword.jsx` is a static screen; the backend reset password flow is not implemented.

Backend:

- `POST /api/v1/auth/register` creates `User`, an empty `UserProfile`, and assigns `system_roles`;
- HR users receive `["JOB_APPLICANT", "JOB_POSTER"]`;
- other roles receive `["JOB_APPLICANT"]`;
- after registration, the backend attempts to upsert the user embedding into Qdrant, but failures do not block registration;
- `POST /api/v1/auth/login` checks the password hash and sets cookies;
- `POST /api/v1/auth/refresh` refreshes the cookie session;
- `POST /api/v1/auth/logout` deletes cookies.

### 2. Dashboard

Frontend `Dashboard.jsx` builds the home experience:

- greeting and profile quick actions;
- links to profile, directory/mentorship, events, and jobs;
- upcoming event cards;
- recommendations/jobs/opportunities sections depending on available data;
- visual summary blocks for quick entry into primary workflows.

Dashboard does not have a dedicated aggregate backend endpoint. It uses existing API clients by domain.

### 3. Profile

Frontend:

- `/profile` shows own or public profile;
- `/profile/:userId` shows another user's profile;
- `/profile/edit` edits profile fields;
- `/profile/resume-import` starts the resume pipeline.

The backend profile response is built through `get_profile_data`:

- if a profile is missing, it is created automatically;
- email and `is_admin` are shown only to the profile owner or an admin viewer;
- career data from a confirmed resume is shown to other users only when the import session has `profile_publish_consent`;
- mentor capacity is calculated as `AVAILABLE`, `LIMITED`, or `FULL`;
- mentee rating is aggregated from `MentorFeedback`;
- profile includes social links, education, experience, skills, career trajectory, mentor fields, and opportunity generation state.

Profile update:

- updates `User.name`, `User.bio`, `User.photo_url`;
- updates `UserProfile` fields;
- refreshes the embedding used for recommendations;
- invalidates profile/directory/recommendations/opportunities caches.

Photo/cover:

- `/profile/me/photo` and `/profile/me/cover` accept image files;
- files are saved through legacy local upload under `/static/avatars` and `/static/covers`;
- delete endpoints clear the URL in the database.

### 4. Directory

Directory searches users by:

- `query` over name/bio;
- role;
- `is_mentor`;
- comma-separated skills;
- location;
- graduation year;
- page/limit.

`SearchService` uses a SQLAlchemy query over `users` with an outer join to `user_profiles`. Skills are filtered through JSONB containment. Directory responses return `ProfileRead`, so user cards receive the same model as the profile screen.

Results are cached in Redis namespace `directory` with TTL `CACHE_DIRECTORY_TTL_SECONDS`.

### 5. Connections and Friends

Connection flow:

1. user sends `POST /connections/request` with `recipient_id`;
2. backend rejects requests to self;
3. if a connection already exists, the service returns the existing record;
4. recipient receives `FRIEND_REQUEST` notification;
5. recipient responds through `POST /connections/{id}/respond`;
6. accepted request creates `FRIEND_ACCEPTED` notification;
7. cache namespaces `friends`, `directory`, and `recommendations` are invalidated;
8. best-effort recommendation prewarm is dispatched for both users.

Friends list returns accepted friends in the compact `ConnectionUser` form.

### 6. Mentorship

Mentor onboarding:

- any active user can become a mentor through `/mentorship/become`;
- `consent_mentor=true` is required;
- backend sets `users.is_mentor=true`;
- mentor headline, help areas, industries, max mentees, availability note, and availability slots are saved;
- profile/directory/recommendations caches are invalidated.

Mentorship request:

- a mentee sends a request to a mentor user;
- requesting mentorship from self is forbidden;
- receiver must be an active mentor;
- mentor capacity is enforced;
- duplicate pending requests are forbidden;
- request is forbidden if an active relationship already exists;
- mentor receives `MENTORSHIP_REQUEST` notification.

Accept request:

- only the receiver mentor can accept;
- request must be `PENDING`;
- capacity is checked;
- `MentorshipRelationship` is created with status `ACTIVE`;
- an initial `MentorshipPlan` is created;
- milestones are built from request goals;
- mentee receives `MENTORSHIP_ACCEPTED` notification.

Decline/cancel:

- decline is done by the mentor and can include a reason;
- cancel is done by the sender for a pending outgoing request.

Relationship workspace:

- `/relationships` returns all mentorship relationships for the current user;
- relationship includes mentor/mentee profiles, plan, and sessions;
- mentor can change relationship status to `ACTIVE`/`COMPLETED`;
- mentor can upsert the plan;
- milestone toggle is available to relationship participants;
- session creation is available to participants of an active relationship;
- session update is available to relationship participants;
- session room name is created as `platform-mentorship-session-{session_id}`.

Mentor feedback:

- feedback is left by the mentor for the mentee in a relationship;
- rating is 1-5;
- one feedback record per relationship; repeat submission updates the existing record;
- mentee receives `MENTOR_FEEDBACK` notification;
- profile shows average rating and feedback count.

### 7. Jobs and Hiring

Job lifecycle:

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> PENDING: submit
    PENDING --> APPROVED: approve by staff/admin/moderator
    PENDING --> DRAFT: reject
    APPROVED --> CLOSED: close by owner/admin
```

Creating a job:

- only users with poster/moderator capability can create jobs;
- a new job always starts as `DRAFT`;
- the creator cannot change status through `PUT`; status changes only through workflow endpoints.

List jobs:

- backend supports optional current user;
- public users see only `APPROVED`;
- job posters see approved jobs plus their own jobs;
- moderators see pending and approved jobs, or use a status filter;
- filters: query, location, employment type, format, company, status;
- moderators see pending jobs first by default.

Job application:

- only `STUDENT` and `ALUMNI` users can apply;
- job must be `APPROVED`;
- duplicate application is forbidden;
- resume reference is required;
- `resume_object_name` must start with `resumes/`;
- job poster receives `JOB_APPLICATION_SUBMITTED` notification.

Resume upload for job applications:

- `POST /jobs/presigned-url` returns a MinIO PUT presigned URL;
- applicant then passes `resume_object_name` or `resume_url` to the apply endpoint.

Application review:

- posters see applications for their own jobs;
- moderators/admins see all applications;
- filters: job id, status, query over applicant/job/company;
- direct status update to `INTERVIEW` is forbidden; the interviewer must schedule an interview;
- status changes create applicant notifications;
- scheduling an interview creates `JobInterview`, sets application status to `INTERVIEW`, creates room name `job-interview-{application_id}`, and notifies applicant;
- resume download returns a 5-minute presigned download URL;
- applicant sees own applications through `/jobs/applications/me`.

Application chat:

- separate entity `job_chat_messages`;
- REST history: `/job-chat/{application_id}/history`;
- WebSocket: `/job-chat/ws/{application_id}`;
- allowed participants: applicant, job creator, admin;
- message is saved and broadcast to active connections in the application room;
- recipient receives `JOB_APPLICATION_MESSAGE` notification.

### 8. Project Board

Project entity contains:

- title, short/full description;
- category;
- required roles;
- required skills;
- project stage;
- team size;
- remote flag;
- contact preference;
- GitHub/demo links;
- tags;
- university/startup/cofounder flags;
- creator.

List projects:

- filters: query, category, required role, skills, remote only, startup only, university only;
- sort: `latest`, `match`, `popular`;
- match score is calculated from overlap between current user skills and project required skills;
- popular sort uses application count.

Recommended projects:

- excludes projects created by the current user;
- reads up to 100 recent projects;
- sorts by match score and creation date;
- returns top `limit`.

User projects:

- `created_projects`;
- `joined_projects`, where the user submitted an application.

Project application:

- user cannot apply to their own project;
- duplicate application is forbidden by unique constraint;
- application contains message, skills, and fit reason;
- response includes match score.

Owner tools:

- owner/admin can update/delete project;
- owner/admin can view applications;
- owner/admin can request suggested candidates;
- suggested candidates are built from users with `profile.skills` and positive match score.

Important: `ProjectApplicationStatus` supports `SUBMITTED`, `REVIEWED`, `ACCEPTED`, and `REJECTED`, but the current code does not include an endpoint for changing project application status.

### 9. Events

Event lifecycle:

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> pending: submit
    pending --> approved: approve staff/admin
    pending --> draft: reject
    approved --> cancelled: cancel organizer/admin
    approved --> completed: status exists, automatic transition not implemented
```

Create event:

- any authenticated active user can create an event;
- event starts as `draft`;
- speakers and materials can be passed during creation;
- `invite-only` sets the legacy `is_public=false` field.

List events:

- staff/admin can see all events or use a status filter;
- regular users see approved events plus their own events;
- backend supports optional current user;
- filters: type, format, status, upcoming only, search;
- response includes registration counts and user-specific registration state.

Moderation:

- submit moves draft -> pending;
- approve is available to staff/admin, moves pending -> approved, writes approver/time, notifies organizer, and can send email;
- reject is available to staff/admin, moves pending -> draft, notifies organizer with reason;
- pending admin list is available to staff/admin.

Registration:

- registration is available only for approved future events;
- if capacity is not set or seats are available, status is `REGISTERED`;
- if capacity is full, status is `WAITLISTED` and waitlist position is assigned;
- notifications and optional emails are created;
- unregister sets registration to `CANCELLED`;
- if a registered attendee unregisters, the first waitlisted user is promoted and positions are recalculated;
- full attendee list is visible to organizer/admin.

Reviews:

- available after `start_time`;
- only registered participants can review;
- one review per event/user;
- rating is 1-5;
- list returns total and average rating.

Event chat:

- available after `start_time`;
- only registered participants can access it;
- messages are paginated by `before` datetime and limit;
- response is returned in chronological order.

Speakers/materials:

- organizer/admin can add and remove speakers/materials;
- speaker can be plain name/link or linked `user_id`;
- material type: agenda/presentation/document/other.

### 10. Direct Messages

Messages feature consists of REST endpoints and `/ws/chat`.

Conversation:

- created through `/messages/conversations/start`;
- 1:1 pair uniqueness is detected by participants;
- starting a conversation with self is forbidden;
- starting is allowed only between friends or mentorship participants.

Message send:

- REST endpoint saves message;
- text or attachment is required;
- creates notifications for recipients;
- broadcasts through `manager.broadcast`;
- read state is updated through `/read` endpoint or WebSocket `message_read` event.

Attachments:

- max size is 25 MB;
- supported MIME types: image/jpeg/png/webp/gif/heic/heif, video/mp4/webm/quicktime, audio/mpeg/mp4/wav/ogg, pdf, zip, MS Office, text/plain;
- user can request a presigned upload URL;
- user can upload through backend multipart upload;
- download endpoint streams object from MinIO and checks conversation membership.

Presence:

- `/ws/chat` stores active connections in memory;
- Redis presence set provides online state across workers;
- Redis pub/sub distributes broadcasts between backend instances;
- friends receive online/offline presence events.

### 11. Video Calls

Video calls use the Jitsi External API.

Backend:

- `/videocall/create-room` accepts `conversation_id`;
- validates that the conversation exists, current user is a participant, and users can message each other;
- room name: `platform-meeting-{conversation_id}`;
- creates system message `JOIN_VIDEO_CALL|{room_name}`;
- broadcasts the system message to participants;
- `/videocall/config` normalizes room name and returns domain, external API URL, and optional JWT.

Jitsi config:

- default domain is `meet.jit.si`;
- JaaS is supported through `8x8.vc` + `JITSI_APP_ID`;
- JWT can be HS256 for self-hosted Jitsi or RS256 for JaaS;
- if JaaS domain is used without JWT config, endpoint returns a server error.

Frontend:

- `JitsiMeet.jsx` dynamically loads external_api.js;
- `VideoCall.jsx` opens the room from the route param.

### 12. Notifications

Notifications are the shared mechanism for:

- friend request;
- friend accepted;
- mentorship request accepted;
- direct message;
- event registration/waitlist/waitlist promoted/cancelled/approved;
- mentor feedback;
- job application submitted/status/interview/application message.

API:

- list notifications with `limit` and `unread_only`;
- unread count;
- mark selected as read;
- mark all as read.

Frontend `NotificationDropdown` fetches list/count and shows unread state. There is no separate WebSocket push for the notification list; direct messages and application chat have their own realtime channels.

### 13. Resume Import

Resume import is the most complex pipeline feature.

Flow:

1. Frontend requests `/resumes/presigned-url` with filename/filetype.
2. Backend validates MIME type: PDF, DOCX, JPEG, PNG, WebP.
3. Backend returns a MinIO presigned PUT URL and object name under prefix `resume-imports`.
4. Frontend uploads the file to MinIO.
5. Frontend creates an import session through `/resumes/imports`.
6. Backend creates `ResumeDocument`, `ResumeImportSession`, and initial `ResumeProcessingJob(EXTRACT_TEXT)`.
7. Celery task claims the job and extracts text.
8. Next job `EXTRACT_STRUCTURED_DATA` builds JSON draft through OpenAI or fallback heuristics.
9. Next job `NORMALIZE_DRAFT` cleans whitespace, skills, employment, and education.
10. Import session moves to `COMPLETED` + `NEEDS_REVIEW`, document moves to `PARSED`.
11. User opens the draft and edits extracted data.
12. User confirms import.
13. Backend creates/updates `AlumniCareerProfile`, education/employment/skills records.
14. If `profile_publish_consent=true`, regular `UserProfile` is updated: name, graduation year, headline, skills, education, experience.
15. If `graph_analytics_consent=true`, career graph is rebuilt.
16. If profile is published, user embedding is refreshed for recommendations.

Text extraction:

- PDF first attempts native text extraction through PyMuPDF;
- if native text is below 400 characters, OCR is used;
- images are processed with OCR;
- DOCX is read through python-docx;
- OCR language is `eng+rus`.

Structured extraction:

- OpenAI model `gpt-4o-mini`, JSON object response;
- if OpenAI is not configured or returns an error/invalid JSON, fallback extracts name, graduation year, and skills with simple heuristics;
- all fields include confidence/requires_review.

Draft editing:

- `PUT /resumes/imports/{id}/draft` can update `draft_json`, `normalized_json`, and `field_confidences`;
- when values change, session becomes `NEEDS_REVIEW`.

Reprocess:

- `/reprocess` sets processing status back to `QUEUED`, confirmation to `NEEDS_REVIEW`, document to `UPLOADED`, and adds a new `EXTRACT_TEXT` job.

### 14. Career Graph and Opportunities

Career graph is built only when the user confirms `graph_analytics_consent`.

Graph nodes:

- alumni;
- university;
- faculty;
- program;
- graduation year;
- company;
- role;
- skill;
- project/internship/certificate enums exist, but current rebuild uses education/employment/skill data.

Graph edges:

- `STUDIED_AT`;
- `BELONGS_TO`;
- `GRADUATED_IN`;
- `HAS_SKILL`;
- `WORKED_AT`;
- `HELD_ROLE`;
- `TRANSITIONED_TO`.

Opportunity page:

- available to students and alumni;
- staff/admin receive `403`;
- built from confirmed alumni career profiles where import session has `graph_analytics_consent=true`;
- public real paths are taken only from profiles with `profile_publish_consent=true`, while aggregate analytics can use graph consent;
- scope: all/faculty/program;
- default scope is program/faculty when at least 3 rows exist;
- graduation year filter is supported;
- directions are aggregated by inferred role family;
- match score considers skill overlap and direction popularity;
- roadmap is built from family blueprint and observed alumni outcomes.

Custom interest:

- `POST /opportunities/interest` saves pending state in `user_profiles.visibility_settings.opportunity_generation`;
- Celery task with countdown completes generation and moves state to `COMPLETED`;
- notification `Roadmap Ready` is created;
- while state is pending, `/opportunities/me` returns `409`;
- `DELETE /opportunities/interest` clears custom preference if generation is not pending.

### 15. People Recommendations

People recommendations agent lives in `backend/app/ai/people_recommendations.py`.

Pipeline:

1. load current user and profile;
2. build textual profile summary;
3. if profile completeness is below `0.35`, embedding is not written;
4. create embedding through sentence-transformers;
5. upsert into Qdrant collection `users`;
6. if collection is empty, bootstrap embeddings for all users with enough profile signal;
7. vector search target roles:
   - for student, target roles = alumni;
   - for mentor, target roles = student;
   - otherwise alumni/student;
8. exclude self;
9. filter by profile completeness;
10. calculate composite match score;
11. collect shared skills/interests and reason;
12. if OpenAI is configured, polish `reason_short` through LLM;
13. if Qdrant is unavailable or empty, use deterministic overlap-based fallback;
14. if still empty, use last-resort recommendations based on filled profiles.

Result is cached in namespace `recommendations` for `CACHE_RECOMMENDATIONS_TTL_SECONDS`.

Admin can call `/recommendations/internal/ai/reindex_users` to rebuild embeddings for all users with profiles.

### 16. AqyldyAI Chat and Knowledge Base

AI chat:

- endpoint `/ai/chat`;
- requires authenticated user;
- stores user message and assistant message;
- first tries to find context in the RAG knowledge base;
- prefers OpenAI when `OPENAI_API_KEY` is set;
- falls back to Gemini when OpenAI is not set and `GOOGLE_AI_API_KEY` is set;
- if neither provider is configured, returns `503`.

The system prompt defines important behavior:

- AI always answers in English;
- knowledge base documents may be in Russian;
- AITU questions should use RAG context;
- completely unrelated topics are rejected.

Knowledge base:

- admin-only PDF upload;
- PDF text is extracted through PyMuPDF;
- text is chunked into 500-character chunks with 50-character overlap;
- embeddings are created through sentence-transformers;
- chunks are written to Qdrant collection `aitu_knowledge_base`;
- uploading the same source deletes old chunks for that source before upsert;
- stats endpoint returns collection name, point count, vector dimension;
- clear endpoint deletes the collection, admin-only.

### 17. Settings, Theme, and Error Boundary

Settings screen mainly works as a frontend account/preferences surface:

- displays account/profile-related state;
- theme is toggled globally through `ThemeToggle`;
- AuthContext logout is available from the shell.

Error handling:

- `ErrorBoundary` catches React rendering errors;
- network-down events from Axios show `ErrorScreen`;
- feature-level API errors are handled inside pages.

## API Map

All REST endpoints below are under `/api/v1`, except health endpoint `/api/health`.

### Auth

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login` | no | form login, sets access/refresh cookies |
| POST | `/auth/register` | no | creates user/profile, sets cookies |
| GET | `/auth/me` | yes | current user |
| POST | `/auth/refresh` | refresh cookie | refreshes cookie session |
| POST | `/auth/logout` | no | deletes cookies |

### Profile

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/profile/me` | yes | own profile |
| PUT | `/profile/me` | yes | update own profile |
| PATCH | `/profile/me/photo` | yes | upload avatar image |
| PATCH | `/profile/me/cover` | yes | upload cover image |
| DELETE | `/profile/me/photo` | yes | delete avatar URL |
| DELETE | `/profile/me/cover` | yes | delete cover URL |
| GET | `/profile/{user_id}` | yes | public user profile |

### Directory

| Method | Path | Auth | Query |
| --- | --- | --- | --- |
| GET | `/directory/` | yes | `query`, `role`, `is_mentor`, `skills`, `location`, `graduation_year`, `page`, `limit` |

### Connections

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/connections/request` | yes | send request |
| POST | `/connections/{connection_id}/respond` | yes | accept/decline request |
| GET | `/connections/` | yes | all current user's connections |
| GET | `/connections/friends` | yes | accepted friends |

### Mentorship

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/mentorship/become` | yes | become a mentor |
| POST | `/mentorship/request` | yes | send mentorship request |
| GET | `/mentorship/requests/incoming` | mentor | incoming pending requests |
| GET | `/mentorship/requests/outgoing` | yes | outgoing requests |
| PUT | `/mentorship/requests/{request_id}/accept` | mentor receiver | accept request |
| PUT | `/mentorship/requests/{request_id}/decline` | mentor receiver | decline request |
| PUT | `/mentorship/requests/{request_id}/cancel` | sender | cancel pending request |
| GET | `/mentorship/relationships` | yes | current user's relationships |
| PATCH | `/mentorship/relationships/{relationship_id}/status` | mentor | update relationship status |
| GET | `/mentorship/relationships/{relationship_id}/plan` | participant | get plan |
| PUT | `/mentorship/relationships/{relationship_id}/plan` | mentor | create/update plan |
| PATCH | `/mentorship/relationships/{relationship_id}/plan/milestones/{milestone_id}` | participant | toggle milestone |
| GET | `/mentorship/relationships/{relationship_id}/sessions` | participant | sessions |
| POST | `/mentorship/relationships/{relationship_id}/sessions` | participant | create session |
| PATCH | `/mentorship/sessions/{session_id}` | participant | update session |
| POST | `/mentorship/relationships/{relationship_id}/feedback` | mentor | create/update feedback |
| GET | `/mentorship/relationships/{relationship_id}/feedback` | participant | get feedback |
| GET | `/mentorship/feedback/received` | yes | feedback received by current user as mentee |

### Jobs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/jobs` | optional | list jobs with filters |
| POST | `/jobs` | poster | create draft job |
| GET | `/jobs/{job_id}` | optional | job detail with visibility checks |
| PUT | `/jobs/{job_id}` | owner/admin | update job fields |
| POST | `/jobs/{job_id}/submit` | owner | draft -> pending |
| POST | `/jobs/{job_id}/approve` | moderator | pending -> approved |
| POST | `/jobs/{job_id}/reject` | moderator | pending -> draft |
| POST | `/jobs/{job_id}/close` | owner/admin | approved -> closed |
| POST | `/jobs/presigned-url` | yes | upload URL for resume |
| POST | `/jobs/{job_id}/apply` | student/alumni | submit application |
| GET | `/jobs/applications/received` | poster/moderator | received applications |
| GET | `/jobs/{job_id}/applications` | owner/moderator | applications for a job |
| PATCH | `/jobs/applications/{application_id}/status` | owner/moderator | status update, except INTERVIEW |
| POST | `/jobs/applications/{application_id}/interviews` | owner/moderator | schedule interview |
| POST | `/jobs/applications/{application_id}/resume-download` | applicant/owner/moderator | presigned resume download |
| GET | `/jobs/applications/me` | yes | my applications |

### Job Chat

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| WS | `/job-chat/ws/{application_id}` | applicant/job owner/admin | realtime application chat |
| GET | `/job-chat/{application_id}/history` | applicant/job owner/admin | history |

### Projects

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/projects` | optional | list projects with filters |
| GET | `/projects/recommended` | yes | recommended projects |
| GET | `/projects/user/{user_id}` | optional | user's created/joined projects |
| POST | `/projects` | yes | create project |
| GET | `/projects/{project_id}` | optional | project detail |
| PUT | `/projects/{project_id}` | owner/admin | update project |
| DELETE | `/projects/{project_id}` | owner/admin | delete project |
| POST | `/projects/{project_id}/apply` | yes | apply to project |
| GET | `/projects/{project_id}/applications` | owner/admin | applications |
| GET | `/projects/{project_id}/candidates` | owner/admin | suggested candidates |

### Events

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/events` | optional | list events |
| POST | `/events` | yes | create draft event |
| GET | `/events/{event_id}` | optional | event detail |
| PUT | `/events/{event_id}` | organizer/admin | update draft/pending |
| DELETE | `/events/{event_id}` | organizer/admin | delete event |
| POST | `/events/{event_id}/submit` | organizer | draft -> pending |
| POST | `/events/{event_id}/approve` | staff/admin | approve |
| POST | `/events/{event_id}/reject` | staff/admin | reject to draft |
| POST | `/events/{event_id}/cancel` | organizer/admin | cancel event and registrations |
| POST | `/events/{event_id}/register` | yes | register/waitlist |
| POST | `/events/{event_id}/unregister` | yes | cancel registration |
| GET | `/events/{event_id}/attendees` | organizer/admin | attendee list |
| GET | `/events/registrations/me` | yes | current user registrations |
| GET | `/events/{event_id}/reviews` | no | event reviews |
| POST | `/events/{event_id}/reviews` | registered participant | create review |
| GET | `/events/{event_id}/messages` | registered participant | event chat messages |
| POST | `/events/{event_id}/messages` | registered participant | create event chat message |
| POST | `/events/{event_id}/speakers` | organizer/admin | add speaker |
| DELETE | `/events/{event_id}/speakers/{speaker_id}` | organizer/admin | remove speaker |
| POST | `/events/{event_id}/materials` | organizer/admin | add material |
| DELETE | `/events/{event_id}/materials/{material_id}` | organizer/admin | remove material |
| GET | `/events/admin/pending` | staff/admin | pending moderation list |

### Messages

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/messages/conversations` | yes | conversations |
| GET | `/messages/conversations/{conversation_id}` | participant | paginated messages |
| POST | `/messages/conversations/start` | yes | get/create conversation |
| POST | `/messages/conversations/{conversation_id}/read` | participant | mark read up to message |
| POST | `/messages/conversations/{conversation_id}/messages` | participant | send message |
| POST | `/messages/attachments/presigned-url` | yes | presigned attachment upload |
| POST | `/messages/attachments/upload` | yes | backend multipart attachment upload |
| GET | `/messages/attachments/{message_id}/download` | participant | stream attachment |

### Notifications

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/notifications/` | yes | notification list |
| GET | `/notifications/unread-count` | yes | unread count |
| POST | `/notifications/mark-read` | yes | mark selected read |
| POST | `/notifications/mark-all-read` | yes | mark all read |

### Resumes

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/resumes/presigned-url` | yes | upload URL |
| POST | `/resumes/imports` | yes | create import session |
| GET | `/resumes/imports` | yes | list imports |
| GET | `/resumes/imports/{import_id}` | owner | import detail |
| GET | `/resumes/imports/{import_id}/draft` | owner | extraction draft |
| PUT | `/resumes/imports/{import_id}/draft` | owner | update draft |
| POST | `/resumes/imports/{import_id}/confirm` | owner | confirm and sync career data |
| POST | `/resumes/imports/{import_id}/reprocess` | owner | enqueue reprocess |

### Recommendations

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/recommendations/people` | yes | people recommendations |
| POST | `/recommendations/internal/ai/reindex_users` | admin | rebuild user embeddings |

### Opportunities

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/opportunities/me` | student/alumni | opportunity page |
| POST | `/opportunities/interest` | student/alumni | start custom roadmap generation |
| DELETE | `/opportunities/interest` | student/alumni | clear custom interest |

### AI

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/ai/chat` | yes | AqyldyAI chat |
| GET | `/ai/chat/history` | yes | chat history |
| POST | `/ai/knowledge-base/upload` | admin | upload PDF to RAG |
| GET | `/ai/knowledge-base/stats` | yes | RAG stats |
| DELETE | `/ai/knowledge-base` | admin | clear RAG collection |

### Video Call

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/videocall/config` | yes | Jitsi domain/room/script/JWT config |
| POST | `/videocall/create-room` | conversation participant | create call room and system message |

## WebSocket Protocols

### `/ws/chat`

Auth:

- Bearer header or access token cookie;
- Origin must be allowed.

Initial server message:

```json
{
  "type": "online_users",
  "payload": {
    "user_ids": ["..."],
    "users": [
      {
        "user_id": "...",
        "is_online": true,
        "last_seen": null
      }
    ]
  }
}
```

Client events:

| Type | Payload | Result |
| --- | --- | --- |
| `send_message` | `conversation_id`, `text`, optional attachment fields | saves message and broadcasts `new_message` |
| `typing_start` | `conversation_id` | broadcasts typing event to other participants |
| `typing_stop` | `conversation_id` | broadcasts typing event to other participants |
| `message_read` | `conversation_id`, `last_read_message_id` | marks read and broadcasts read receipt |
| `ping` | none | refreshes presence, server sends `pong` |
| `get_online_users` | none | sends current friends presence snapshot |

Server events:

- `online_users`;
- `presence`;
- `new_message`;
- `typing_start`;
- `typing_stop`;
- `message_read`;
- `error`;
- `pong`.

### `/api/v1/job-chat/ws/{application_id}`

Auth:

- Bearer header, `token` query param, or access token cookie;
- Origin check;
- user must be applicant, job creator, or admin.

Protocol:

- client sends raw text;
- backend saves `JobChatMessage`;
- backend broadcasts JSON string:

```json
{
  "sender_id": "...",
  "message": "text",
  "created_at": "2026-05-15T10:00:00.000000"
}
```

## Background Jobs

Celery app: `backend/app/core/celery_app.py`.

Queues:

- `resumes`;
- `opportunities`;
- `recommendations`;
- `default`.

Celery Beat:

- every 30 seconds calls `app.tasks.resume.dispatch_queued_resume_jobs`;
- the task finds stale queued resume jobs older than 30 seconds and dispatches them to queue `resumes`.

Tasks:

| Task | Queue | Purpose |
| --- | --- | --- |
| `app.tasks.resume.process_resume_job` | resumes | process one resume job |
| `app.tasks.resume.dispatch_queued_resume_jobs` | resumes | pick up queued resume jobs |
| `app.tasks.opportunities.finalize_interest_generation` | opportunities | complete pending custom interest roadmap |
| `app.tasks.recommendations.prewarm_people_recommendations` | recommendations | recalculate and store people recommendations in Redis cache |

Celery settings:

- late ack;
- reject on worker lost;
- task time limit 900s, soft limit 840s;
- result expires 3600s;
- worker prefetch multiplier 1;
- retry backoff for tasks.

## Caching and Invalidation

`backend/app/core/cache.py` stores Redis JSON strings.

Cache key format:

```text
v1:{namespace}:{sha256(normalized_parts_and_params)}
```

Namespaces:

- `profile`;
- `directory`;
- `friends`;
- `conversations`;
- `messages`;
- `notifications`;
- `recommendations`;
- `opportunities`.

Default TTLs:

| Namespace/use | Env |
| --- | --- |
| default | `CACHE_DEFAULT_TTL_SECONDS=60` |
| directory | `CACHE_DIRECTORY_TTL_SECONDS=45` |
| profile | `CACHE_PROFILE_TTL_SECONDS=120` |
| conversations | `CACHE_CONVERSATIONS_TTL_SECONDS=15` |
| messages | `CACHE_MESSAGES_TTL_SECONDS=30` |
| recommendations | `CACHE_RECOMMENDATIONS_TTL_SECONDS=300` |
| opportunities | `CACHE_OPPORTUNITIES_TTL_SECONDS=300` |

Key invalidation points:

- profile update/photo/cover/delete -> profile, directory, recommendations, opportunities;
- connection request/respond -> friends, directory, recommendations;
- messaging save/read -> conversations, messages, notifications;
- notification read -> notifications;
- resume confirmation -> profile, directory, recommendations, opportunities;
- opportunity interest change -> opportunities;
- recommendations prewarm writes recommendations cache.

## File Storage

There are two file models.

### Legacy Local Static Uploads

Used for:

- profile photo;
- profile cover.

Files are saved in `UPLOAD_DIR`; backend mounts `/static`.

### MinIO/S3-Compatible Uploads

Used for:

- resume imports;
- job application resumes;
- message attachments;
- event materials store URLs, but a dedicated material upload endpoint is not implemented.

Storage helpers:

- `generate_presigned_url` for PUT upload;
- `upload_bytes` for backend multipart upload;
- `generate_presigned_download_url` for 5-minute GET URL;
- `get_object_stream` for protected streaming downloads.

Public endpoint is inferred in this order:

1. `MINIO_PUBLIC_ENDPOINT`, when set;
2. origin/referer of the current request + `/storage`;
3. forwarded host + `/storage`;
4. fallback to `MINIO_ENDPOINT`.

## Security

### Implemented Security Controls

- password hashing with passlib bcrypt;
- JWT access/refresh tokens;
- HttpOnly cookies;
- configurable cookie flags: secure, sameSite, domain;
- CSRF-style Origin guard for mutating methods;
- CORS allowlist;
- role/capability guards;
- Redis rate limits;
- attachment MIME/size validation;
- backend permission checks for private downloads;
- Nginx security headers: CSP, frame-ancestors none, X-Frame-Options, nosniff, referrer policy;
- OpenAPI can be disabled in production.

### Practical Production Requirements

- `SECRET_KEY` must be long and random;
- `AUTH_COOKIE_SECURE=true` should be used only with HTTPS;
- `BACKEND_CORS_ORIGINS` must contain the real frontend origins;
- `ENABLE_OPENAPI=false` unless public API docs are intentionally exposed;
- PostgreSQL, Redis, Qdrant, and MinIO should not be publicly reachable without a deliberate operational reason;
- MinIO credentials, DB password, AI keys, and SMTP credentials must be rotated before production;
- `.env` and `.env.prod` must not be committed.

## Environment Configuration

Base template: `.env.example`.

Minimum required for local Docker:

```env
POSTGRES_USER=alumni_user
POSTGRES_PASSWORD=alumni_password
POSTGRES_DB=alumni_db
DATABASE_URL=postgresql://alumni_user:alumni_password@postgres:5432/alumni_db
SECRET_KEY=change-me
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=alumni-files
```

AI:

- `OPENAI_API_KEY` is used for OpenAI AI chat, structured resume extraction, and LLM-polished recommendations;
- `GOOGLE_AI_API_KEY` is used as fallback for AI chat;
- without keys, base features work, but AI endpoints return configuration errors or fallback extraction.

Qdrant:

- `QDRANT_URL`;
- `QDRANT_API_KEY`;
- `EMBEDDING_MODEL`.

Important: `config.py` default embedding model is `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, while `.env.example` uses `sentence-transformers/all-MiniLM-L6-v2`. Both produce 384-dimensional embeddings, but the multilingual model better fits RAG with Russian documents.

Jitsi:

- `JITSI_DOMAIN=meet.jit.si` by default;
- JaaS requires `JITSI_APP_ID`, signing key/key id, and RS256 configuration;
- self-hosted token auth can use HS256 shared secret.

SMTP:

- if SMTP is not configured, email service silently skips sends and logs a warning;
- in-app notifications are still created.

OAuth:

- `.env.example` contains `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`;
- current backend code does not implement OAuth endpoints, so these are placeholder configuration values.

## Run, Migrations, and Deployment

### Local Docker

The local compose file includes an optional `agent` service, but this checkout does not include an `agent/` directory. Start the main services explicitly:

```bash
docker compose up -d --build \
  postgres qdrant redis-cache redis-celery minio \
  backend celery-worker celery-beat frontend
```

Backend container runs:

```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Local URLs:

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:3030` |
| Backend | `http://localhost:8010` |
| OpenAPI | `http://localhost:8010/docs` |
| Health | `http://localhost:8010/api/health` |
| MinIO API | `http://localhost:9000` |
| MinIO Console | `http://localhost:9001` |
| Qdrant | `http://localhost:6333` |
| PostgreSQL | `localhost:5543` |

### Production Docker

Production compose:

- backend uses `Dockerfile.prod`;
- frontend is built and served by Nginx;
- only frontend exposes host port `3030`;
- backend/postgres/redis/qdrant/minio are internal;
- backend `start.sh` applies migrations and starts uvicorn workers.

Command:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

### Migrations

Manual migration:

```bash
docker compose exec backend alembic upgrade head
```

Create migration:

```bash
docker compose exec backend alembic revision --autogenerate -m "describe_change"
```

### Seed Data

`backend/seed_users.py` creates sample users. The script does not deduplicate records, so it is safest to run only on a clean development database.

## Testing and Quality

Backend:

```bash
docker compose exec backend pip install ruff pytest pytest-asyncio httpx
docker compose exec backend pytest -q
docker compose exec backend ruff check .
```

Frontend:

```bash
docker compose exec frontend npm run lint
docker compose exec frontend npm run build
```

Current backend tests:

- `test_app_imports`;
- `test_health_endpoint_returns_ok`.

CI/CD workflow:

- backend lint/test/build;
- frontend lint/build;
- production compose syntax validation;
- gitleaks secret scan;
- deploy to droplet on push to `main`;
- deploy records current SHA, pulls origin/main, rebuilds production compose, health checks backend, rolls back on failed health check.

In CI, ruff/eslint/gitleaks currently use `continue-on-error`, so they are warning-only. Backend and frontend production builds must pass.

## Current Limitations

This section is important so the team does not treat planned placeholders as implemented features.

- OAuth variables exist in `.env.example`, but Google/LinkedIn OAuth endpoints are not implemented.
- Forgot password page exists on the frontend, but backend password reset flow is not implemented.
- Feed page is currently placeholder/static.
- Event status `completed` exists in the enum, but automatic transition to completed is not implemented.
- Email reminder method exists, but there is no Celery schedule for 24-hour reminders.
- Job status enum contains `REJECTED`, but the reject endpoint moves pending job back to `DRAFT`.
- Job update endpoint allows owner or admin, but not staff moderator, even though moderation endpoints allow staff.
- Project application statuses exist, but there is no endpoint for accepting/rejecting project applications.
- Notifications do not have separate WebSocket push; dropdown reads API, while realtime exists for messages/application chat.
- Profile avatar/cover use local `/static`, while resumes/messages use MinIO.
- Knowledge base AI chat always instructs the assistant to answer in English, even if the user writes in another language.
- Resume job types `SYNC_PROFILE` and `BUILD_GRAPH` exist in the enum, but do not have Celery handlers; sync/graph runs during confirm.
- RAG Qdrant collection dimension is fixed at 384; if the embedding model changes to a different dimension, the collection must be recreated.
- Plain `docker compose up` tries to build the missing `agent/` service; use the explicit service list or move agent to a profile.
