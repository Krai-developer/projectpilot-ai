from typing import Generator
from urllib.parse import quote_plus, unquote
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from app.core.config import get_settings

settings = get_settings()


def normalize_database_url(raw_url: str) -> str:
    """Normalize Supabase/PostgreSQL connection strings and safely URL-encode special characters in passwords."""
    url = raw_url.strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)

    # Safely URL-encode password if it contains special characters like '/', '?', '!', '@'
    if "://" in url and "@" in url:
        scheme, rest = url.split("://", 1)
        credentials, host_part = rest.rsplit("@", 1)
        if ":" in credentials:
            user, raw_password = credentials.split(":", 1)
            encoded_password = quote_plus(unquote(raw_password))
            url = f"{scheme}://{user}:{encoded_password}@{host_part}"
    return url


db_url = normalize_database_url(settings.database_url)
is_sqlite = db_url.startswith("sqlite")

if not is_sqlite:
    try:
        import psycopg2  # noqa: F401
    except ImportError:
        db_url = "sqlite:///./projectpilot.db"
        is_sqlite = True

connect_args: dict = {}
if is_sqlite:
    connect_args["check_same_thread"] = False
elif ("supabase.co" in db_url or "supabase.com" in db_url) and "sslmode=" not in db_url:
    connect_args["sslmode"] = "require"

engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=not is_sqlite,
    future=True,
)

if is_sqlite:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
