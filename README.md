# Alumni Social Network

A full-stack alumni engagement platform for AITU students, alumni, mentors, university staff, and hiring partners. The application brings together professional profiles, mentorship, job and project discovery, events, real-time messaging, video calls, resume import, and AI-assisted recommendations in one Docker-first system.

<p align="center">
  <img src="docs/assets/readme-hero.svg" alt="Alumni Social Network developer overview banner" width="100%" />
</p>

<p align="center">
  <img alt="React 18" src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=111827" />
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-Python_3.11-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img alt="Docker Compose" src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img alt="Redis" src="https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white" />
  <img alt="AI ready" src="https://img.shields.io/badge/AI-OpenAI_+_Gemini-111827?style=for-the-badge&logo=openai&logoColor=white" />
</p>

## Table of Contents

- [Visual Overview](#visual-overview)
- [Features](#features)
- [Technical Documentation](#technical-documentation)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Development Commands](#development-commands)
- [API Reference](#api-reference)
- [Testing and Quality](#testing-and-quality)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Security Notes](#security-notes)
- [License](#license)

## Visual Overview

<p align="center">
  <img src="docs/assets/developer-stickers.svg" alt="Developer themed sticker pack for API, Docker, queues, migrations, vector search, and deployment" width="92%" />
</p>

```mermaid
flowchart LR
    Visitor["Visitor"] --> Auth["Auth"]
    Auth --> Profile["Profile"]
    Profile --> Network["Directory + Connections"]
    Profile --> Mentor["Mentorship"]
    Profile --> Careers["Jobs + Projects"]
    Profile --> Events["Events"]
    Network --> Messages["Messages + Notifications"]
    Mentor --> Video["Video Calls"]
    Careers --> Resume["Resume Import"]
    Resume --> AI["AI + Recommendations"]
    AI --> Network
    AI --> Careers
```

## Features

- Authentication with access and refresh cookies, password hashing, role-aware access, and CSRF origin checks.
- User profiles with education, experience, skills, social links, avatars, cover images, visibility fields, and resume-derived profile drafts.
- Directory, connections, friends, and people recommendations for networking across students, alumni, mentors, staff, and HR users.
- Mentorship workflows for mentor onboarding, requests, relationships, learning plans, milestones, sessions, and feedback.
- Job board with draft, submit, approve, reject, close, application tracking, resume downloads, interview scheduling, and application chat.
- Project board for publishing ideas, matching candidates by skills, applying to teams, and managing project applications.
- Events module with moderation, registrations, waitlists, speakers, materials, reviews, and event discussions.
- Real-time messaging, job application chat, notifications, attachments, unread counts, and WebSocket delivery.
- AI features for chat, knowledge base upload, resume extraction, opportunity generation, people recommendations, and vector search.
- Video calls through configurable Jitsi or JaaS settings.
- Docker Compose development and production stacks with PostgreSQL, Redis, Celery, Qdrant, MinIO, FastAPI, React, and Nginx.

## Technical Documentation

For a detailed Russian-language technical reference covering architecture, data models, REST and WebSocket APIs, permissions, background jobs, caching, storage, deployment, and every implemented feature, see [docs/TECHNICAL_DOCUMENTATION.md](docs/TECHNICAL_DOCUMENTATION.md).

## Architecture

```mermaid
flowchart TB
    Browser["Browser"]
    Frontend["React + Vite dev server<br/>or Nginx production frontend"]
    Backend["FastAPI backend<br/>/api/v1 + /ws"]
    Postgres[("PostgreSQL 16<br/>relational data")]
    RedisCache[("Redis cache<br/>cache, pub/sub, rate limits")]
    RedisCelery[("Redis Celery<br/>broker + results")]
    Worker["Celery worker"]
    Beat["Celery beat"]
    Qdrant[("Qdrant<br/>vector search")]
    MinIO[("MinIO<br/>S3-compatible files")]
    AI["OpenAI / Google AI"]
    SMTP["SMTP provider"]
    Jitsi["Jitsi / JaaS"]

    Browser --> Frontend
    Frontend -->|"/api, /ws"| Backend
    Frontend -->|"/storage"| MinIO
    Backend --> Postgres
    Backend --> RedisCache
    Backend --> Qdrant
    Backend --> MinIO
    Backend --> AI
    Backend --> SMTP
    Backend --> Jitsi
    Backend --> RedisCelery
    RedisCelery --> Worker
    RedisCelery --> Beat
    Worker --> Postgres
    Worker --> Qdrant
    Worker --> MinIO
```

The backend exposes versioned REST APIs under `/api/v1`, health checks under `/api/health`, and WebSocket routes for real-time features. The frontend is a protected React single-page application with route-level pages for dashboard, profiles, directory, mentorship, jobs, projects, events, messages, AI chat, recommendations, settings, and video calls.

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 18, Vite 5, React Router, Axios, Framer Motion, CSS stylesheets |
| Backend | Python 3.11, FastAPI, Uvicorn, Gunicorn, Pydantic v2, SQLAlchemy 2, Alembic |
| Data | PostgreSQL 16, Qdrant, Redis 7, MinIO |
| Background jobs | Celery, Redis broker/result backend, Celery Beat |
| AI and documents | OpenAI SDK, Google Generative AI, LangChain, sentence-transformers, PyMuPDF, python-docx, Tesseract OCR |
| Infrastructure | Docker, Docker Compose, Nginx, GitHub Actions |

## Getting Started

### Prerequisites

- Git
- Docker and Docker Compose v2
- At least 6 GB of free disk space for images and ML dependencies
- Optional: `openssl` for generating a production-grade `SECRET_KEY`

### 1. Clone and configure

```bash
git clone <repo-url>
cd <repo-directory>

cp .env.example .env
```

Edit `.env` before the first run. For local Docker development, keep the database host as `postgres`:

```env
DATABASE_URL=postgresql://alumni_user:alumni_password@postgres:5432/alumni_db
SECRET_KEY=replace-this-with-a-long-random-value
AUTH_COOKIE_SECURE=false
ENABLE_OPENAPI=true
```

Generate a stronger secret when `openssl` is available:

```bash
openssl rand -hex 32
```

AI features are optional for basic local development. Add `OPENAI_API_KEY` and/or `GOOGLE_AI_API_KEY` when you want AI chat, resume extraction, recommendations, and opportunity generation to work.

### 2. Start the development stack

The compose file includes one optional service named `agent` that expects an `agent/` directory. This checkout does not include that directory, so start the main application services explicitly:

```bash
docker compose up -d --build \
  postgres qdrant redis-cache redis-celery minio \
  backend celery-worker celery-beat frontend
```

The backend container runs Alembic migrations automatically on startup. You can also run migrations manually:

```bash
docker compose exec backend alembic upgrade head
```

### 3. Open the app

| Service | Local URL |
| --- | --- |
| Frontend | http://localhost:3030 |
| Backend API | http://localhost:8010 |
| OpenAPI docs | http://localhost:8010/docs |
| Health check | http://localhost:8010/api/health |
| MinIO API | http://localhost:9000 |
| MinIO console | http://localhost:9001 |
| PostgreSQL | `localhost:5543` |
| Qdrant | http://localhost:6333 |

### 4. Optional seed data

For a fresh local database, seed sample users:

```bash
docker compose exec backend python seed_users.py
```

The seed script creates users such as `user0@example.com` with the local-only password `password123`. It does not de-duplicate records, so run it only on a clean development database.

## Environment Configuration

Start from `.env.example`. Do not commit real `.env` or `.env.prod` files.

### Required for local Docker

| Variable | Purpose |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | PostgreSQL container credentials and database name |
| `DATABASE_URL` | SQLAlchemy connection URL. Use `postgres` as the host inside Docker |
| `SECRET_KEY` | JWT signing key. Use a long random value outside local experiments |
| `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` | S3-compatible storage credentials and bucket |

### Common optional variables

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Resume extraction and OpenAI-backed recommendation/AI features |
| `GOOGLE_AI_API_KEY` | Google Gemini-backed AI chat fallback |
| `BACKEND_CORS_ORIGINS` | Comma-separated production frontend origins |
| `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE`, `AUTH_COOKIE_DOMAIN` | Cookie behavior for local HTTP vs production HTTPS |
| `ENABLE_OPENAPI` | Enables `/docs`, `/redoc`, and OpenAPI JSON |
| `QDRANT_URL`, `QDRANT_API_KEY`, `EMBEDDING_MODEL` | Vector search and embedding configuration |
| `REDIS_CACHE_URL`, `REDIS_PUBSUB_URL`, `REDIS_RATE_LIMIT_URL` | Cache, pub/sub, and rate-limit Redis databases |
| `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` | Celery broker and result backend |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Email delivery for event notifications |
| `JITSI_DOMAIN`, `JITSI_APP_ID`, `JITSI_EXTERNAL_API_URL`, `JITSI_JWT_*` | Video call provider and optional JWT signing |
| `VITE_API_URL`, `VITE_WS_URL` | Frontend direct backend URLs. Leave empty when using the bundled proxy |

## Development Commands

| Task | Command |
| --- | --- |
| Show running services | `docker compose ps` |
| Follow backend logs | `docker compose logs -f backend` |
| Follow frontend logs | `docker compose logs -f frontend` |
| Follow worker logs | `docker compose logs -f celery-worker` |
| Run migrations | `docker compose exec backend alembic upgrade head` |
| Create a migration | `docker compose exec backend alembic revision --autogenerate -m "describe_change"` |
| Open backend shell | `docker compose exec backend bash` |
| Stop containers | `docker compose down` |
| Rebuild backend and frontend | `docker compose build backend frontend` |
| Reset local volumes | `docker compose down -v` |

Use `docker compose down -v` only when you intentionally want to delete local PostgreSQL, Qdrant, MinIO, and Redis data.

## API Reference

When `ENABLE_OPENAPI=true`, interactive API documentation is available at:

- Swagger UI: http://localhost:8010/docs
- ReDoc: http://localhost:8010/redoc
- OpenAPI JSON: http://localhost:8010/api/v1/openapi.json

Main API groups:

| Prefix | Domain |
| --- | --- |
| `/api/v1/auth` | Login, registration, refresh, logout, current user |
| `/api/v1/profile` | Current and public profiles, avatar and cover management |
| `/api/v1/directory` | User search and filtering |
| `/api/v1/connections` | Connection requests and friends |
| `/api/v1/mentorship` | Mentor onboarding, requests, relationships, plans, sessions, feedback |
| `/api/v1/jobs` | Job lifecycle, applications, interviews, resume download URLs |
| `/api/v1/job-chat` | Job application chat history and WebSocket messaging |
| `/api/v1/projects` | Project board, applications, candidate suggestions |
| `/api/v1/events` | Event lifecycle, registrations, reviews, materials, speakers, messages |
| `/api/v1/messages` | Conversations, direct messages, attachments |
| `/api/v1/notifications` | Notification list, unread counts, read status |
| `/api/v1/resumes` | Resume uploads, imports, drafts, confirmation, reprocessing |
| `/api/v1/recommendations` | People recommendations and internal reindexing |
| `/api/v1/opportunities` | Personalized opportunity generation |
| `/api/v1/ai` | AI chat, history, knowledge base upload and stats |
| `/api/v1/videocall` | Jitsi/JaaS config and room creation |

## Testing and Quality

The runtime backend image keeps dependencies focused on the application. Install development-only tools in the running container before local checks:

```bash
docker compose exec backend pip install ruff pytest pytest-asyncio httpx
docker compose exec backend pytest -q
docker compose exec backend ruff check .
```

Frontend lint and production build:

```bash
docker compose exec frontend npm run lint
docker compose exec frontend npm run build
```

The GitHub Actions workflow runs backend lint/tests/build, frontend lint/build, production compose validation, a secret scan, and deployment on pushes to `main`.

## Deployment

Production uses `docker-compose.prod.yml` and `.env.prod`.

```bash
cp .env.example .env.prod
# Edit .env.prod before deploying.

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

The production backend image runs `backend/start.sh`, which applies Alembic migrations before starting Uvicorn workers.

Recommended production settings:

```env
DATABASE_URL=postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@postgres:5432/<POSTGRES_DB>
SECRET_KEY=<long-random-secret>
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=lax
BACKEND_CORS_ORIGINS=https://your-domain.example
ENABLE_OPENAPI=false
MINIO_PUBLIC_ENDPOINT=
```

In the production compose file, PostgreSQL, Redis, Qdrant, MinIO, and the backend are internal services. The frontend Nginx container exposes port `3030` and proxies `/api`, `/ws`, `/static`, and `/storage` to internal services. Put a public reverse proxy such as Nginx, Caddy, Traefik, or a cloud load balancer in front of that port for HTTPS.

### GitHub Actions deployment

The included workflow deploys on pushes to `main` when these repository secrets are configured:

| Secret | Purpose |
| --- | --- |
| `DROPLET_HOST` | Server hostname or IP |
| `DROPLET_USER` | SSH user |
| `DROPLET_SSH_KEY` | Private SSH key |
| `DROPLET_PORT` | SSH port, optional |
| `DROPLET_PROJECT_PATH` | Absolute path to the checked-out project on the server |

The deployment job fetches `origin/main`, restarts the production compose stack, checks backend health, and rolls back to the previous commit if the health check fails.

## Project Structure

```text
.
|-- backend/
|   |-- app/
|   |   |-- api/v1/endpoints/   # FastAPI route modules
|   |   |-- ai/                 # RAG and recommendation agents
|   |   |-- core/               # config, database, security, cache, storage
|   |   |-- models/             # SQLAlchemy models
|   |   |-- schemas/            # Pydantic schemas
|   |   |-- services/           # domain services
|   |   `-- tasks/              # Celery tasks
|   |-- alembic/                # database migrations
|   |-- tests/                  # backend tests
|   |-- Dockerfile
|   `-- Dockerfile.prod
|-- frontend/
|   |-- src/
|   |   |-- api/                # Axios clients by domain
|   |   |-- components/         # shared UI and feature components
|   |   |-- context/            # auth and theme providers
|   |   |-- hooks/              # reusable React hooks
|   |   |-- pages/              # route-level screens
|   |   `-- utils/              # frontend helpers
|   |-- Dockerfile
|   |-- Dockerfile.prod
|   `-- nginx.conf
|-- docker-compose.yml          # local development stack
|-- docker-compose.prod.yml     # production stack
|-- .env.example                # documented environment template
`-- .github/workflows/deploy.yml
```

## Troubleshooting

### `failed to solve: "./agent": not found`

The local compose file defines an `agent` service, but this checkout does not include the `agent/` build context. Use the explicit service startup command from [Getting Started](#getting-started), restore the missing service, or move that compose service behind a profile before running plain `docker compose up`.

### Backend cannot connect to PostgreSQL

Inside Docker, `DATABASE_URL` must use `postgres` as the host. Use `localhost` only when running backend code directly on the host machine.

### AI endpoints return configuration errors

Set `OPENAI_API_KEY` and/or `GOOGLE_AI_API_KEY`. Basic authentication, profiles, directory, jobs, projects, events, and messaging do not require AI keys.

### CORS or cookie issues in production

Set `BACKEND_CORS_ORIGINS` to the public frontend origin, use HTTPS, set `AUTH_COOKIE_SECURE=true`, and configure `AUTH_COOKIE_DOMAIN` only when cookies must be shared across subdomains.

### Uploaded files are not reachable

For local development, the backend compose service sets `MINIO_PUBLIC_ENDPOINT=http://localhost:9000`. For production, leave `MINIO_PUBLIC_ENDPOINT` empty when serving storage through the frontend Nginx `/storage` proxy, or set it to a real public storage URL.

### Jitsi asks for moderator authentication

The default `meet.jit.si` domain may require the first room moderator to authenticate. For production, use a self-hosted Jitsi instance or JaaS and configure the `JITSI_*` variables.

## Security Notes

- Never commit `.env`, `.env.prod`, private keys, API keys, database dumps, or uploaded user files.
- Rotate `SECRET_KEY`, `POSTGRES_PASSWORD`, `MINIO_SECRET_KEY`, AI keys, and SMTP credentials before production use.
- Keep PostgreSQL, Redis, Qdrant, and MinIO off the public internet unless there is a deliberate operational reason to expose them.
- Disable public API documentation in production with `ENABLE_OPENAPI=false` unless you explicitly need it.
- Use HTTPS in production and set `AUTH_COOKIE_SECURE=true`.
- Review rate limit values before public launch, especially for auth, AI, and messaging endpoints.

## License

This project is distributed under the MIT License. See [LICENSE](LICENSE) for the full license text.
