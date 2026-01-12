#!/bin/bash
echo "=== ENTRYPOINT DEBUG ==="
echo "LIVEKIT_URL: '${LIVEKIT_URL}'"
echo "LIVEKIT_API_KEY length: ${#LIVEKIT_API_KEY}"

exec python main.py start \
    --url "${LIVEKIT_URL}" \
    --api-key "${LIVEKIT_API_KEY}" \
    --api-secret "${LIVEKIT_API_SECRET}"
