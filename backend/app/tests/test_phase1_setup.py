import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.models.entities import Project, Task, TaskDependency, User


def test_required_database_tables_created(db_session: Session):
    inspector = inspect(db_session.get_bind())
    table_names = set(inspector.get_table_names())
    expected_tables = {
        "users",
        "revoked_tokens",
        "projects",
        "requirements",
        "milestones",
        "tasks",
        "task_requirements",
        "task_dependencies",
        "task_evidence",
        "assessments",
        "activity_logs",
    }
    assert expected_tables.issubset(table_names)


def test_task_positive_weight_constraint(db_session: Session):
    user = User(email="owner@example.com", password_hash="hashed")
    db_session.add(user)
    db_session.commit()

    project = Project(owner_id=user.id, name="Constraint Test Project")
    db_session.add(project)
    db_session.commit()

    bad_task = Task(project_id=project.id, title="Zero Weight Task", weight=0.0)
    db_session.add(bad_task)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_self_dependency_constraint(db_session: Session):
    user = User(email="dep@example.com", password_hash="hashed")
    db_session.add(user)
    db_session.commit()

    project = Project(owner_id=user.id, name="Self Dep Project")
    db_session.add(project)
    db_session.commit()

    task = Task(project_id=project.id, title="Task 1", weight=1.0)
    db_session.add(task)
    db_session.commit()

    self_dep = TaskDependency(task_id=task.id, depends_on_task_id=task.id)
    db_session.add(self_dep)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_health_endpoint(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["database"] == "connected"


def test_ai_health_endpoint_handles_unavailable_gracefully(client: TestClient, monkeypatch):
    import httpx

    async def mock_get(*args, **kwargs):
        raise httpx.ConnectError("Connection refused")

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)
    response = client.get("/api/health/ai")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "unavailable"
    assert body["ollama_reachable"] is False
    assert body["fallback_mode"] == "deterministic_rules_active"
