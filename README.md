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

## Прод-стэк на отдельном файле
Используем `.env.prod` (уже в .gitignore) и `docker-compose.prod.yml`:
```bash
# Запуск prod-стэка на дроплете/сервере
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# Миграции в prod-стэке
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend alembic upgrade head
```
Главные переменные в `.env.prod`: `DATABASE_URL` с хостом `postgres`, `SECRET_KEY`, `OPENAI_API_KEY`, `BACKEND_CORS_ORIGINS`, `VITE_API_URL` (указывает на публичный backend `8010`), `POSTGRES_*`.

## Деплой на один DigitalOcean droplet (Docker Compose)
1. Подготовить код и конфиг:
   ```bash
   git clone <repo-url>
   cd alumni-social-network
   cp .env.example .env
   ```
2. Заполнить ключевые переменные (минимум):
   - `DATABASE_URL=postgresql+psycopg2://<POSTGRES_USER>:<POSTGRES_PASSWORD>@postgres:5432/<POSTGRES_DB>` (хост именно `postgres`, не `localhost`).
   - `SECRET_KEY=<случайная_строка>` (обязателен).
   - `OPENAI_API_KEY=<ключ>` (если нужны AI-рекомендации).
   - `BACKEND_CORS_ORIGINS=http://<ваш-домен-или-ip>:3030` (можно перечислением через запятую).
   - `VITE_API_URL=http://<ваш-домен-или-ip>:8010` (URL API, который увидит браузер).
3. Запустить стэк:
   ```bash
   docker compose up -d --build
   ```
4. Применить миграции:
   ```bash
   docker compose exec backend alembic upgrade head
   ```

### Что важно для безопасности
- По умолчанию наружу публикуются только `8010` (backend API) и `3030` (frontend). Postgres и Qdrant остаются внутри сети Compose — откройте их наружу только при явной необходимости.
- Настройте firewall на дроплете: разрешите вход только на нужные порты (обычно 80/443 с прокси или 3030/8010, если без прокси).
- Храните `SECRET_KEY`, `POSTGRES_PASSWORD`, `OPENAI_API_KEY` в `.env`, не коммитьте их в репозиторий.
- При смене домена не забудьте обновить `BACKEND_CORS_ORIGINS` и `VITE_API_URL`, затем пересобрать `frontend`.

## Порты и сервисы
| Сервис      | URL/порт                   |
|-------------|----------------------------|
| Frontend    | http://localhost:3030      |
| Backend API | http://localhost:8010      |
| API Docs    | http://localhost:8010/docs |
| Postgres    | внутренняя сеть docker-compose (`postgres:5432`) |
| Qdrant      | внутренняя сеть docker-compose (`qdrant:6333`) |

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
