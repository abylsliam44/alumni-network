FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for audio processing and LiveKit RTC
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    libglib2.0-0 \
    libglib2.0-dev \
    libgstreamer1.0-0 \
    libgstreamer-plugins-base1.0-0 \
    libssl-dev \
    libsrtp2-1 \
    libopus0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run the agent worker
CMD ["python", "main.py", "start"]

