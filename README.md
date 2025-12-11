# Alumni Social Network

Полноценное full-stack приложение для студентов, выпускников и менторов AITU. Запуск локально — только через Docker Compose.

## Что внутри
- Frontend: React 18 + Vite
- Backend: FastAPI (Python 3.11)
- DB: PostgreSQL 16
- Векторное хранилище: Qdrant
- Контейнеризация: Docker Compose

## Предварительные требования
- Docker и Docker Compose
- Свой `.env`, скопированный из `.env.example`
- Ключ `OPENAI_API_KEY` для LLM-пояснений в рекомендациях (обязателен, если нужна AI-рекомендация)

## Быстрый старт (Docker)
```bash
git clone <repo-url>
cd alumni-social-network

# Подготовить окружение
cp .env.example .env
# Заполните .env: POSTGRES_* / DATABASE_URL / SECRET_KEY / OPENAI_API_KEY / QDRANT_URL (пробрасывается по умолчанию) / при необходимости QDRANT_API_KEY и EMBEDDING_MODEL
# Для фронтенда при необходимости установите VITE_API_URL (по умолчанию http://localhost:8010)

# Сборка и запуск всех сервисов
docker compose up -d --build

# Применить миграции
docker compose exec backend alembic upgrade head
```

## Порты и сервисы
| Сервис      | URL/порт                   |
|-------------|----------------------------|
| Frontend    | http://localhost:3030      |
| Backend API | http://localhost:8010      |
| API Docs    | http://localhost:8010/docs |
| Postgres    | localhost:5543 (alumni_db) |
| Qdrant      | http://localhost:6333      |

## Полезные команды
- Логи backend: `docker compose logs -f backend`
- Логи frontend: `docker compose logs -f frontend`
- Остановить: `docker compose down`
- Пересобрать после изменений зависимостей: `docker compose build backend frontend`

## Структура проекта
```
├── backend/          # FastAPI backend
├── frontend/         # React frontend
├── docker-compose.yml
└── .env.example
```

## Минимальный набор переменных окружения
- Backend: `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `SECRET_KEY`, `OPENAI_API_KEY`, `QDRANT_URL` (+ `QDRANT_API_KEY` если нужен), `EMBEDDING_MODEL` (по умолчанию all-MiniLM-L6-v2). Дополнительно можно задать `BACKEND_CORS_ORIGINS`.
- Frontend: `VITE_API_URL` (если отличный от http://localhost:8010).
