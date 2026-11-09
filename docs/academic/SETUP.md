# Учебная версия: локальный запуск

Реализация находится в разработке и пока не прошла полную приёмку по ТЗ. Используйте только для локальной демонстрации, не для production.

```sh
cp .env.academic.example .env.academic
docker compose --env-file .env.academic -f docker-compose.academic.yml up -d --build
docker compose --env-file .env.academic -f docker-compose.academic.yml exec backend python scripts/academic_create_indexes.py
docker compose --env-file .env.academic -f docker-compose.academic.yml exec backend python scripts/academic_seed.py --seed 42
```

Интерфейс: http://localhost:3031. API: http://localhost:8011/docs. Все seed-данные синтетические. Локальный вход: `demo0@example.test`, пароль `DemoPass123!`. `demo0` — администратор. Сброс учебных коллекций: добавьте `--reset` к команде seed; он уничтожает записи этих коллекций и допустим только для `alumni_academic`.

Остановить контейнеры без удаления данных:

```sh
docker compose --env-file .env.academic -f docker-compose.academic.yml down
```

Отдельный volume `alumni-academic_academic_mongo` сохраняется. PostgreSQL и volumes основной платформы эти команды не затрагивают. Проверка готовности: `curl http://localhost:8011/api/health/ready`.

## Интеграционные тесты

Тесты используют отдельную базу `alumni_academic_test` на том же локальном replica set. Запустите второй backend внутри контейнера, дождитесь его готовности и запустите тесты:

```sh
docker compose --env-file .env.academic -f docker-compose.academic.yml exec -d -e MONGODB_DATABASE=alumni_academic_test backend uvicorn app.main:app --host 127.0.0.1 --port 8001
docker compose --env-file .env.academic -f docker-compose.academic.yml exec backend python -m unittest tests.test_academic_integration -v
```

Тесты создают записи в тестовой базе и не удаляют их. Это лишь часть приёмки.

## Offline-импорт (экспериментальный)

Скрипт `backend/scripts/academic_import_from_postgres.py` требует дополнительных зависимостей из `backend/requirements.academic-import.txt`, сетевой доступ к источнику и `SOURCE_DATABASE_URL` в окружении. По умолчанию он выполняет dry run; запись включается флагом `--execute`. Источник открывается в read-only repeatable-read транзакции. До применения используйте отдельные тестовые PostgreSQL и MongoDB, остановите записи в источник и проверьте отчёт. На минимальном синтетическом источнике проверены dry run, повторный импорт и конфликт изменённого документа; полная приёмка не завершена. Не запускайте на production-данных.
