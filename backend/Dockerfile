FROM python:3.12-slim

WORKDIR /app

# Install system build dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

# Create persistent data directory for SQLite
RUN mkdir -p /app/data

ENV DATABASE_URL=sqlite:////app/data/projectpilot.db
ENV APP_ENV=production

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
