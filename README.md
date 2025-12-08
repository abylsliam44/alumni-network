# Alumni Social Network

Полноценное full-stack приложение для студентов, выпускников и менторов AITU.

## Быстрый старт

```bash
# Клонируем проект
git clone <repo-url>
cd alumni-social-network

# Копируем env
cp .env.example .env

# Поднимаем все сервисы (фронт + бэкенд + Postgres)
docker-compose up -d --build
```

## 📍 Порты и сервисы (у меня заняты остальные порты, поэтому вы тоже испоользуйте эти пж!)

| Сервис        | URL/порт                    |
|---------------|-----------------------------|
| Frontend      | http://localhost:3030       |
| Backend API   | http://localhost:8010       |
| API Docs      | http://localhost:8010/docs  |
| Postgres      | localhost:5543 (alumni_db)  |

## 🛠 Технологии

- **Frontend**: React 18 + Vite
- **Backend**: FastAPI (Python 3.11)
- **Database**: PostgreSQL 16
- **Container**: Docker Compose

## 📁 Структура

```
├── backend/          # FastAPI backend
├── frontend/         # React frontend
├── docker-compose.yml
└── .env.example
```

## 🔐 Переменные окружения

Используйте `.env.example` как шаблон; ключи (в т.ч. `OPENAI_API_KEY`) задаются там и пробрасываются в контейнеры.

