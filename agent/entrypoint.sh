#!/bin/bash
# Entrypoint для агента - передаём переменные окружения через CLI аргументы

exec python main.py start \
    --url "${LIVEKIT_URL}" \
    --api-key "${LIVEKIT_API_KEY}" \
    --api-secret "${LIVEKIT_API_SECRET}"
