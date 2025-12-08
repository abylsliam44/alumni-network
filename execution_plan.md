# Alumni Social Network - Execution Plan

> **Purpose**: Step-by-step AI agent prompts for building the complete MVP.
> Each step must be tested and verified before proceeding to the next.

---

## STEP 1: Project Initialization & Health Check

### Prompt for AI Agent:
```
Create the initial project structure for Alumni Social Network:

1. Create folder structure:
   - /backend (FastAPI Python)
   - /frontend (React + Vite)
   - /docker (Docker configurations)

2. Backend setup (FastAPI):
   - Create requirements.txt with pinned versions:
     - fastapi==0.104.1
     - uvicorn[standard]==0.24.0
     - sqlalchemy==2.0.23
     - alembic==1.12.1
     - psycopg2-binary==2.9.9
     - python-jose[cryptography]==3.3.0
     - passlib[bcrypt]==1.7.4
     - python-multipart==0.0.6
     - pydantic[email]==2.5.2
     - pydantic-settings==2.1.0
     - python-dotenv==1.0.0
   - Create main.py with health check endpoint GET /api/health
   - Create Dockerfile for backend

3. Frontend setup (React + Vite):
   - Initialize with: npx -y create-vite@5.0.0 . --template react
   - Install deps: react-router-dom@6.20.0, axios@1.6.2
   - Create health check component that calls backend /api/health
   - Create Dockerfile for frontend

4. Docker Compose:
   - Create docker-compose.yml with services:
     - postgres:16-alpine (port 5432)
     - backend (port 8000)
     - frontend (port 3000)
   - Add .env.example with all required variables

5. Verification:
   - Run: docker-compose up --build
   - Test: curl http://localhost:8000/api/health returns {"status": "ok"}
   - Test: http://localhost:3000 shows health status from backend
```

**Success Criteria**: All services start, frontend displays "Backend Connected: OK"

---

## STEP 2: Database Schema & SQLAlchemy Models

### Prompt for AI Agent:
```
Create database models for Alumni Social Network:

1. Create backend/app/models/ directory with:
   - __init__.py
   - base.py (SQLAlchemy Base, common mixins)
   - user.py (User, UserProfile models)
   - connection.py (Connection, MentorshipRequest)
   - mentorship.py (MentorshipRelationship)
   - message.py (Message, Conversation)
   - event.py (Event, EventRegistration)
   - job.py (JobPosting, JobApplication)

2. User model fields:
   - id (UUID, primary key)
   - email (unique, indexed)
   - hashed_password
   - name, photo_url, bio
   - role (enum: STUDENT, ALUMNI, MENTOR, ADMIN, COMPANY_REP)
   - is_active, is_verified
   - created_at, updated_at

3. UserProfile model (one-to-one with User):
   - education (JSON), skills (JSON array)
   - experience (JSON array), career_interests (JSON)
   - availability, location, graduation_year
   - linkedin_url, visibility_settings (JSON)

4. Setup Alembic:
   - alembic init alembic
   - Configure alembic/env.py for async
   - Create initial migration

5. Create backend/app/core/database.py:
   - Database session management
   - get_db dependency

6. Verification:
   - Run: docker-compose up --build
   - Run: docker-compose exec backend alembic upgrade head
   - Connect to postgres and verify tables exist
```

**Success Criteria**: All tables created in PostgreSQL, no migration errors

---

## STEP 3: Authentication System - JWT

### Prompt for AI Agent:
```
Implement JWT authentication:

1. Create backend/app/core/security.py:
   - Password hashing (bcrypt)
   - JWT token creation (access + refresh)
   - Token verification

2. Create backend/app/core/config.py:
   - Pydantic Settings for environment variables
   - SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

3. Create backend/app/schemas/:
   - auth.py (TokenResponse, LoginRequest, RegisterRequest)
   - user.py (UserCreate, UserRead, UserUpdate)

4. Create backend/app/api/v1/endpoints/auth.py:
   - POST /api/v1/auth/register
   - POST /api/v1/auth/login
   - POST /api/v1/auth/refresh
   - GET /api/v1/auth/me (protected)

5. Create backend/app/api/deps.py:
   - get_current_user dependency
   - get_current_active_user
   - require_roles decorator

6. Verification:
   - Test register: POST /api/v1/auth/register with email/password
   - Test login: POST /api/v1/auth/login returns tokens
   - Test protected: GET /api/v1/auth/me with Bearer token
   - Test invalid token returns 401
```

**Success Criteria**: Can register, login, and access protected routes

---

## STEP 4: Frontend Authentication UI

### Prompt for AI Agent:
```
Create frontend authentication pages:

1. Setup frontend structure:
   - src/api/axios.ts (configured axios instance)
   - src/api/auth.ts (auth API calls)
   - src/context/AuthContext.tsx (auth state management)
   - src/hooks/useAuth.ts

2. Create pages:
   - src/pages/Login.tsx
   - src/pages/Register.tsx
   - src/pages/ForgotPassword.tsx (placeholder)

3. Create components:
   - src/components/ui/Input.tsx
   - src/components/ui/Button.tsx
   - src/components/ui/Card.tsx
   - src/components/ProtectedRoute.tsx

4. Setup routing in App.tsx:
   - / -> redirect based on auth
   - /login -> Login page
   - /register -> Register page
   - /dashboard -> Protected route

5. Styling:
   - Create modern dark theme CSS
   - Responsive design
   - Form validation feedback

6. Verification:
   - Navigate to /register, create account
   - Navigate to /login, login with credentials
   - Verify redirect to /dashboard
   - Refresh page, verify still logged in (token persistence)
   - Logout, verify redirect to /login
```

**Success Criteria**: Full auth flow works in browser

---

## STEP 5: User Profile CRUD

### Prompt for AI Agent:
```
Implement user profile management:

1. Backend API (backend/app/api/v1/endpoints/profile.py):
   - GET /api/v1/profile/me - get own profile
   - PUT /api/v1/profile/me - update own profile
   - GET /api/v1/profile/{user_id} - get public profile
   - PATCH /api/v1/profile/me/photo - upload photo

2. Create schemas:
   - ProfileRead, ProfileUpdate
   - EducationItem, ExperienceItem, SkillItem

3. File upload handling:
   - Create backend/app/core/storage.py
   - Store files in /uploads volume
   - Generate unique filenames
   - Serve static files

4. Frontend pages:
   - src/pages/Profile.tsx (view own profile)
   - src/pages/EditProfile.tsx (edit form)
   - src/pages/PublicProfile.tsx (view others)

5. Frontend components:
   - ProfileCard, ProfileHeader
   - EducationForm, ExperienceForm
   - SkillsInput, PhotoUpload

6. Verification:
   - Create profile with all fields
   - Upload profile photo
   - View profile displays all data
   - Edit and save changes
   - View another user's public profile
```

**Success Criteria**: Complete profile CRUD with photo upload

---

## STEP 6: Alumni Directory & Search

### Prompt for AI Agent:
```
Implement alumni directory with search:

1. Backend API (backend/app/api/v1/endpoints/directory.py):
   - GET /api/v1/directory - list users with pagination
   - Query params: search, role, graduation_year, industry, 
     skills, location, page, limit

2. Create search service:
   - backend/app/services/search.py
   - Full-text search on name, bio
   - Filter by multiple criteria
   - Pagination with total count

3. Frontend pages:
   - src/pages/Directory.tsx

4. Frontend components:
   - DirectoryFilters (sidebar with filter options)
   - UserCard (compact user display)
   - Pagination component
   - SearchInput with debounce

5. Styling:
   - Grid layout for user cards
   - Collapsible filters on mobile
   - Loading states

6. Verification:
   - Load directory with 20+ users
   - Search by name returns correct results
   - Filter by graduation year works
   - Filter by skills works
   - Pagination shows correct pages
   - Combine multiple filters
```

**Success Criteria**: Directory with working search and filters

---

## STEP 7: Mentorship Request System

### Prompt for AI Agent:
```
Implement mentorship requests:

1. Backend API (backend/app/api/v1/endpoints/mentorship.py):
   - POST /api/v1/mentorship/request - send request
   - GET /api/v1/mentorship/requests/incoming - view received
   - GET /api/v1/mentorship/requests/outgoing - view sent
   - PUT /api/v1/mentorship/requests/{id}/accept
   - PUT /api/v1/mentorship/requests/{id}/decline
   - GET /api/v1/mentorship/relationships - active mentorships

2. Create models if not exists:
   - MentorshipRequest (status: PENDING, ACCEPTED, DECLINED)
   - MentorshipRelationship

3. Business logic:
   - Prevent duplicate requests
   - Auto-create relationship on accept
   - Notification hooks (placeholder)

4. Frontend pages:
   - src/pages/Mentorship.tsx (dashboard)
   - src/pages/FindMentor.tsx (search mentors)

5. Frontend components:
   - MentorshipRequestCard
   - MentorshipRelationshipCard
   - SendRequestModal

6. Verification:
   - Send mentorship request with goals
   - View pending requests as mentor
   - Accept request, verify relationship created
   - Decline request, verify status updated
   - View active mentorships dashboard
```

**Success Criteria**: Complete mentorship request flow

---

## STEP 8: Real-time Messaging - WebSocket

### Prompt for AI Agent:
```
Implement real-time messaging:

1. Backend WebSocket (backend/app/api/v1/websocket.py):
   - WebSocket endpoint /api/v1/ws/{user_id}
   - Connection manager class
   - JWT authentication for WebSocket

2. Backend API:
   - GET /api/v1/messages/conversations - list conversations
   - GET /api/v1/messages/{conversation_id} - get messages
   - POST /api/v1/messages - send message (also via WS)

3. Message model:
   - sender_id, recipient_id
   - content, attachments (JSON)
   - is_read, created_at

4. Frontend:
   - src/context/WebSocketContext.tsx
   - src/hooks/useWebSocket.ts
   - src/pages/Messages.tsx
   - src/components/ConversationList.tsx
   - src/components/ChatWindow.tsx
   - src/components/MessageBubble.tsx

5. Features:
   - Real-time message delivery
   - Typing indicator (optional)
   - Read receipts
   - Scroll to bottom on new message

6. Verification:
   - Open chat in two browser windows
   - Send message, appears in both instantly
   - Verify message persisted to database
   - Refresh page, messages still there
   - Mark as read updates status
```

**Success Criteria**: Real-time bidirectional messaging works

---

## STEP 9: Events Module

### Prompt for AI Agent:
```
Implement events functionality:

1. Backend API (backend/app/api/v1/endpoints/events.py):
   - GET /api/v1/events - list upcoming events
   - GET /api/v1/events/{id} - event details
   - POST /api/v1/events - create event (admin/alumni)
   - PUT /api/v1/events/{id} - update event
   - DELETE /api/v1/events/{id} - delete event
   - POST /api/v1/events/{id}/register - RSVP
   - DELETE /api/v1/events/{id}/register - cancel RSVP
   - GET /api/v1/events/{id}/attendees - list attendees

2. Event model:
   - title, description, date_time
   - location (physical or virtual URL)
   - max_attendees, current_count
   - organizer_id, is_public

3. Frontend pages:
   - src/pages/Events.tsx (list)
   - src/pages/EventDetail.tsx
   - src/pages/CreateEvent.tsx (for organizers)

4. Frontend components:
   - EventCard, EventForm
   - AttendeesList, RSVPButton

5. Verification:
   - Create event with all details
   - View event in list and detail page
   - Register for event
   - See registration count update
   - Cancel registration
   - View attendee list
```

**Success Criteria**: Events can be created, viewed, and registered for

---

## STEP 10: Job Board

### Prompt for AI Agent:
```
Implement job board functionality:

1. Backend API (backend/app/api/v1/endpoints/jobs.py):
   - GET /api/v1/jobs - list jobs with filters
   - GET /api/v1/jobs/{id} - job details
   - POST /api/v1/jobs - post job (alumni/company)
   - PUT /api/v1/jobs/{id} - update job
   - DELETE /api/v1/jobs/{id} - delete job
   - POST /api/v1/jobs/{id}/apply - submit application
   - GET /api/v1/jobs/applications - my applications
   - GET /api/v1/jobs/{id}/applications - applications for job

2. Job model:
   - title, company, location, job_type
   - description, requirements (JSON)
   - salary_range, deadline
   - posted_by, is_active

3. Application model:
   - job_id, applicant_id
   - resume_url, cover_letter
   - status: SUBMITTED, REVIEWED, REJECTED, ACCEPTED

4. Frontend pages:
   - src/pages/Jobs.tsx (list with filters)
   - src/pages/JobDetail.tsx
   - src/pages/PostJob.tsx
   - src/pages/MyApplications.tsx

5. Frontend components:
   - JobCard, JobFilters
   - ApplicationForm, ApplicationStatus

6. Verification:
   - Post job listing
   - Browse and filter jobs
   - Apply with resume upload
   - View application status
   - Job poster views applications
```

**Success Criteria**: Complete job posting and application flow

---

## STEP 11: Admin Dashboard

### Prompt for AI Agent:
```
Implement admin dashboard:

1. Backend API (backend/app/api/v1/endpoints/admin.py):
   - GET /api/v1/admin/users - list all users
   - GET /api/v1/admin/users/{id} - user details
   - PUT /api/v1/admin/users/{id}/suspend - suspend user
   - PUT /api/v1/admin/users/{id}/activate - activate user
   - PUT /api/v1/admin/users/{id}/role - change role
   - GET /api/v1/admin/metrics - dashboard metrics

2. Metrics to track:
   - Total users by role
   - New registrations (7/30 days)
   - Active mentorships
   - Events this month
   - Job applications

3. Admin middleware:
   - Require ADMIN role
   - Audit logging (placeholder)

4. Frontend pages:
   - src/pages/admin/Dashboard.tsx
   - src/pages/admin/Users.tsx
   - src/pages/admin/UserDetail.tsx

5. Frontend components:
   - MetricCard, MetricChart
   - UserTable, UserActions
   - AdminSidebar

6. Verification:
   - Login as admin
   - View dashboard metrics
   - Search and filter users
   - Suspend a user, verify they can't login
   - Change user role
   - Reactivate user
```

**Success Criteria**: Admin can manage users and view metrics

---

## STEP 12: OAuth2 Integration (Google/LinkedIn)

### Prompt for AI Agent:
```
Add OAuth2 social login:

1. Backend OAuth (backend/app/core/oauth.py):
   - Google OAuth2 configuration
   - LinkedIn OAuth2 configuration
   - Token exchange handlers

2. Backend endpoints:
   - GET /api/v1/auth/google - redirect to Google
   - GET /api/v1/auth/google/callback - handle callback
   - GET /api/v1/auth/linkedin - redirect to LinkedIn
   - GET /api/v1/auth/linkedin/callback - handle callback

3. User linking:
   - Create user if not exists
   - Link to existing user by email
   - Store provider info

4. Frontend:
   - Add social login buttons
   - Handle OAuth redirect flow
   - Display linked accounts in settings

5. Configuration:
   - Add OAuth credentials to .env.example
   - Document setup process

6. Verification:
   - Click "Login with Google"
   - Complete OAuth flow
   - Verify user created/linked
   - Can login with Google again
   - (LinkedIn similar)
```

**Success Criteria**: OAuth login works for both providers

---

## STEP 13: UI Polish & Responsive Design

### Prompt for AI Agent:
```
Polish the UI and ensure responsive design:

1. Design system:
   - Create CSS variables for colors, spacing
   - Typography scale
   - Component variants (primary, secondary, danger)
   - Dark mode support

2. Responsive breakpoints:
   - Mobile: <768px
   - Tablet: 768-1024px
   - Desktop: >1024px

3. Navigation:
   - Mobile hamburger menu
   - Sticky header
   - Bottom navigation (mobile)

4. Polish each page:
   - Loading states (skeletons)
   - Error states
   - Empty states
   - Animations/transitions

5. Accessibility:
   - Semantic HTML
   - ARIA labels
   - Keyboard navigation
   - Focus indicators

6. Verification:
   - Test all pages on mobile viewport
   - Test all pages on tablet viewport
   - Verify all forms are usable on mobile
   - Check contrast ratios
   - Tab through forms
```

**Success Criteria**: App is fully responsive and accessible

---

## STEP 14: Integration Testing

### Prompt for AI Agent:
```
Add integration tests:

1. Backend tests (pytest):
   - tests/conftest.py (fixtures, test DB)
   - tests/test_auth.py
   - tests/test_profile.py
   - tests/test_mentorship.py
   - tests/test_messaging.py
   - tests/test_events.py
   - tests/test_jobs.py
   - tests/test_admin.py

2. Test database:
   - Use separate test database
   - Rollback after each test

3. API tests:
   - Test all CRUD operations
   - Test error cases (400, 401, 403, 404)
   - Test pagination
   - Test filters

4. Add to docker-compose.test.yml:
   - Test database service
   - Test runner service

5. Verification:
   - Run: docker-compose -f docker-compose.test.yml up --abort-on-container-exit
   - All tests pass
   - Coverage > 80%
```

**Success Criteria**: All tests pass with good coverage

---

## STEP 15: Documentation & Deployment Prep

### Prompt for AI Agent:
```
Finalize documentation:

1. README.md:
   - Project overview
   - Quick start with docker-compose
   - Development setup
   - Environment variables
   - API documentation link

2. API Documentation:
   - OpenAPI/Swagger auto-generated
   - Add endpoint descriptions
   - Request/response examples

3. .env.example:
   - All required variables
   - Example values
   - Comments explaining each

4. docker-compose.yml:
   - Production-ready configuration
   - Health checks
   - Restart policies
   - Volume persistence

5. CONTRIBUTING.md:
   - Development workflow
   - Code style
   - PR process

6. Verification:
   - Fresh clone
   - Copy .env.example to .env
   - docker-compose up --build
   - App works end-to-end
```

**Success Criteria**: New developer can run app in under 5 minutes

---

## Post-MVP Steps (Future)

These are documented but not part of MVP:

- **AI Recommendations**: Semantic matching for mentors
- **Social Posts**: Feed with posts and comments
- **Groups**: Interest-based groups
- **Advanced Analytics**: Detailed reports
- **Payments**: Event tickets, donations
- **Mobile App**: React Native version
- **Email Notifications**: Transactional emails
- **Rate Limiting**: API protection
- **Caching**: Redis integration
