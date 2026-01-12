#!/bin/bash
echo "=== ENTRYPOINT DEBUG ==="
ls -la .env || echo ".env not found"

# Если переменные пусты, пробуем загрузить из .env вручную (fallback)
if [ -z "$LIVEKIT_URL" ] && [ -f .env ]; then
  echo "Loading from .env..."
  export $(grep -v '^#' .env | xargs)
fi

echo "LIVEKIT_URL: '${LIVEKIT_URL}'"
echo "LIVEKIT_API_KEY length: ${#LIVEKIT_API_KEY}"

exec python main.py start \
    --url "${LIVEKIT_URL}" \
    --api-key "${LIVEKIT_API_KEY}" \
    --api-secret "${LIVEKIT_API_SECRET}"
