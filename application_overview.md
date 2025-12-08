# Alumni Social Network - Application Overview

> **Single source of truth for all application information**

---

## 1. Project Summary

| Property | Value |
|----------|-------|
| **Name** | Alumni Social Network |
| **Type** | Fullstack Web Application |
| **Goal** | Connect students, alumni, and mentors for career development |
| **MVP Timeline** | 2-3 months |
| **Run Command** | `docker-compose up --build` |

---

## 2. Technology Stack

### Backend
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | FastAPI | 0.104.1 |
| Server | Uvicorn | 0.24.0 |
| ORM | SQLAlchemy | 2.0.23 |
| Migrations | Alembic | 1.12.1 |
| Auth | python-jose | 3.3.0 |
| Passwords | passlib[bcrypt] | 1.7.4 |
| Validation | Pydantic | 2.5.2 |

### Frontend
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | React | 18.2.0 |
| Build Tool | Vite | 5.0.0 |
| Routing | react-router-dom | 6.20.0 |
| HTTP Client | axios | 1.6.2 |
| Styling | Vanilla CSS | - |

### Infrastructure
| Component | Technology | Version |
|-----------|------------|---------|
| Database | PostgreSQL | 16-alpine |
| Container | Docker | latest |
| Orchestration | Docker Compose | v2 |

---

## 3. Project Structure

```
alumni-social-network/
├── docker-compose.yml
├── .env.example
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/
│   └── app/
│       ├── main.py
│       ├── core/
│       │   ├── config.py
│       │   ├── security.py
│       │   ├── database.py
│       │   └── oauth.py
│       ├── models/
│       │   ├── user.py
│       │   ├── profile.py
│       │   ├── mentorship.py
│       │   ├── message.py
│       │   ├── event.py
│       │   └── job.py
│       ├── schemas/
│       │   └── [pydantic schemas]
│       ├── api/
│       │   ├── deps.py
│       │   └── v1/
│       │       ├── router.py
│       │       └── endpoints/
│       └── services/
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── api/
        ├── context/
        ├── hooks/
        ├── components/
        └── pages/
```

---

## 4. Database Schema

### Core Tables

**users**
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| hashed_password | VARCHAR(255) | |
| name | VARCHAR(100) | NOT NULL |
| photo_url | VARCHAR(500) | |
| bio | TEXT | |
| role | ENUM | DEFAULT 'STUDENT' |
| is_active | BOOLEAN | DEFAULT true |
| is_verified | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMP | DEFAULT now() |
| updated_at | TIMESTAMP | |

**user_profiles**
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK -> users, UNIQUE |
| education | JSONB | |
| skills | JSONB | Array |
| experience | JSONB | Array |
| career_interests | JSONB | |
| availability | VARCHAR(50) | |
| location | VARCHAR(100) | |
| graduation_year | INTEGER | |
| linkedin_url | VARCHAR(500) | |
| visibility | JSONB | |

**mentorship_requests**
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| mentor_id | UUID | FK -> users |
| mentee_id | UUID | FK -> users |
| status | ENUM | PENDING/ACCEPTED/DECLINED |
| goals | TEXT | |
| intro_message | TEXT | |
| created_at | TIMESTAMP | |

**mentorship_relationships**
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| mentor_id | UUID | FK -> users |
| mentee_id | UUID | FK -> users |
| goals | TEXT | |
| notes | JSONB | |
| created_at | TIMESTAMP | |

**messages**
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| sender_id | UUID | FK -> users |
| recipient_id | UUID | FK -> users |
| content | TEXT | NOT NULL |
| attachments | JSONB | |
| is_read | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMP | |

**events**
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| title | VARCHAR(200) | NOT NULL |
| description | TEXT | |
| date_time | TIMESTAMP | NOT NULL |
| location | VARCHAR(300) | |
| max_attendees | INTEGER | |
| organizer_id | UUID | FK -> users |
| is_public | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMP | |

**event_registrations**
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| event_id | UUID | FK -> events |
| user_id | UUID | FK -> users |
| status | ENUM | REGISTERED/ATTENDED/CANCELLED |
| created_at | TIMESTAMP | |

**job_postings**
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| title | VARCHAR(200) | NOT NULL |
| company | VARCHAR(200) | NOT NULL |
| location | VARCHAR(100) | |
| job_type | ENUM | FULL_TIME/PART_TIME/INTERNSHIP |
| description | TEXT | |
| requirements | JSONB | |
| salary_range | VARCHAR(100) | |
| deadline | DATE | |
| posted_by | UUID | FK -> users |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMP | |

**job_applications**
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| job_id | UUID | FK -> job_postings |
| applicant_id | UUID | FK -> users |
| resume_url | VARCHAR(500) | |
| cover_letter | TEXT | |
| status | ENUM | SUBMITTED/REVIEWED/REJECTED/ACCEPTED |
| created_at | TIMESTAMP | |

---

## 5. API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/auth/register | Register new user |
| POST | /api/v1/auth/login | Login, get tokens |
| POST | /api/v1/auth/refresh | Refresh access token |
| GET | /api/v1/auth/me | Get current user |
| GET | /api/v1/auth/google | Google OAuth |
| GET | /api/v1/auth/linkedin | LinkedIn OAuth |

### Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/profile/me | Get own profile |
| PUT | /api/v1/profile/me | Update profile |
| GET | /api/v1/profile/{id} | Get user profile |
| PATCH | /api/v1/profile/me/photo | Upload photo |

### Directory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/directory | Search users |

### Mentorship
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/mentorship/request | Send request |
| GET | /api/v1/mentorship/requests/incoming | Received requests |
| GET | /api/v1/mentorship/requests/outgoing | Sent requests |
| PUT | /api/v1/mentorship/requests/{id}/accept | Accept |
| PUT | /api/v1/mentorship/requests/{id}/decline | Decline |
| GET | /api/v1/mentorship/relationships | Active mentorships |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| WS | /api/v1/ws/{user_id} | WebSocket connection |
| GET | /api/v1/messages/conversations | List conversations |
| GET | /api/v1/messages/{conv_id} | Get messages |
| POST | /api/v1/messages | Send message |

### Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/events | List events |
| GET | /api/v1/events/{id} | Event details |
| POST | /api/v1/events | Create event |
| PUT | /api/v1/events/{id} | Update event |
| DELETE | /api/v1/events/{id} | Delete event |
| POST | /api/v1/events/{id}/register | RSVP |
| DELETE | /api/v1/events/{id}/register | Cancel RSVP |

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/jobs | List jobs |
| GET | /api/v1/jobs/{id} | Job details |
| POST | /api/v1/jobs | Post job |
| PUT | /api/v1/jobs/{id} | Update job |
| DELETE | /api/v1/jobs/{id} | Delete job |
| POST | /api/v1/jobs/{id}/apply | Apply |
| GET | /api/v1/jobs/applications | My applications |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/admin/users | List users |
| PUT | /api/v1/admin/users/{id}/suspend | Suspend |
| PUT | /api/v1/admin/users/{id}/activate | Activate |
| PUT | /api/v1/admin/users/{id}/role | Change role |
| GET | /api/v1/admin/metrics | Dashboard metrics |

---

## 6. User Roles & Permissions

| Role | Directory | Mentorship | Events | Jobs | Admin |
|------|-----------|------------|--------|------|-------|
| Student | View | Request mentor | View, RSVP | View, Apply | ❌ |
| Alumni | View | Be mentor | Create, View | Post, View | ❌ |
| Mentor | View | Be mentor | Create, View | Post, View | ❌ |
| Company Rep | View | ❌ | View | Post, View | ❌ |
| Admin | View, Edit | Manage | Manage | Manage | ✅ Full |

---

## 7. Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/alumni_db

# Security
SECRET_KEY=your-secret-key-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# Frontend
VITE_API_URL=http://localhost:8000/api/v1

# Storage
UPLOAD_DIR=/app/uploads
MAX_UPLOAD_SIZE=5242880
```

---

## 8. Ports & Services

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Backend API | 8000 | http://localhost:8000 |
| API Docs | 8000 | http://localhost:8000/docs |
| PostgreSQL | 5432 | localhost:5432 |

---

## 9. MVP Features Checklist

| Feature | Status | Priority |
|---------|--------|----------|
| User Registration/Login | ⬜ | P0 |
| User Profiles | ⬜ | P0 |
| Alumni Directory | ⬜ | P0 |
| Mentorship Requests | ⬜ | P0 |
| Real-time Messaging | ⬜ | P0 |
| Events | ⬜ | P1 |
| Job Board | ⬜ | P1 |
| Admin Dashboard | ⬜ | P1 |
| OAuth (Google/LinkedIn) | ⬜ | P2 |

---

## 10. Development Commands

```bash
# Start all services
docker-compose up --build

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Run migrations
docker-compose exec backend alembic upgrade head

# Create new migration
docker-compose exec backend alembic revision --autogenerate -m "description"

# Enter backend shell
docker-compose exec backend bash

# Run tests
docker-compose exec backend pytest

# Stop all services
docker-compose down

# Reset database
docker-compose down -v
docker-compose up --build
```

---

## 11. Future Enhancements (Post-MVP)

- AI-powered mentor matching
- Social feed with posts/comments
- Interest-based groups
- Advanced analytics dashboard
- Payment integration
- Mobile app (React Native)
- Email notifications
- Redis caching
- Rate limiting
