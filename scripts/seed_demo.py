"""
Seed a demo user and realistic project into the local ProjectPilot AI SQLite database.

Usage (from repo root):
    backend\\.venv\\Scripts\\python scripts/seed_demo.py
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.api.projects import create_demo_project  # noqa: E402
from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.entities import User  # noqa: E402


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        email = "demo@projectpilot.local"
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                full_name="Demo Engineer",
                password_hash=hash_password("DemoPass123!"),
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Created demo user: {email} (password: DemoPass123!)")
        else:
            print(f"Using existing demo user: {email} (password: DemoPass123!)")

        proj = create_demo_project(current_user=user, db=db)
        print(
            f"Seeded demo project '{proj.name}' (ID={proj.id}) — "
            f"Progress={proj.progress_percentage}%, Readiness='{proj.readiness_status}'"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
