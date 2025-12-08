# Alumni Social Network

A fullstack web application connecting students, alumni, and mentors for career development.

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd alumni-social-network

# Copy environment file
cp .env.example .env

# Start all services
docker-compose up --build
```

## 📍 Services

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

## 🛠 Tech Stack

- **Frontend**: React 18 + Vite
- **Backend**: FastAPI (Python 3.11)
- **Database**: PostgreSQL 16
- **Container**: Docker Compose

## 📁 Project Structure

```
├── backend/          # FastAPI backend
├── frontend/         # React frontend
├── docker-compose.yml
└── .env.example
```

## 🔐 Environment Variables

See `.env.example` for all required configuration.

## 📝 License

MIT
