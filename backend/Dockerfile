FROM python:3.11-slim

# Faster, cleaner Python in containers.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as a non-root user.
RUN useradd -m appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

# In-memory session state (sse_manager) ties a run to one process, so we run a
# single worker. Scale out only with a shared session store (e.g. Redis).
# --proxy-headers / --forwarded-allow-ips lets the app sit behind a TLS proxy.
# ${PORT:-8000} supports platforms (Render/Railway/Fly) that inject $PORT.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips=*"]
