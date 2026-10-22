import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.entities import Project, Task, TaskStatus, User
from app.services.completion_service import (
    calculate_weighted_progress,
    validate_project_status_transition,
)
from app.tests.test_phase2_auth_crud import register_and_headers


def test_unit_weighted_progress_and_empty_project(db_session: Session):
    user = User(email="unit@example.com", password_hash="hash")
    db_session.add(user)
    db_session.commit()
    project = Project(owner_id=user.id, name="Unit Progress Project")
    db_session.add(project)
    db_session.commit()

    # Empty project -> 0.0% without division by zero
    pct, comp_w, tot_w = calculate_weighted_progress([], project.id)
    assert pct == 0.0
    assert comp_w == 0.0
    assert tot_w == 0.0

    # Weighted tasks: Done(3.0) + InProgress(5.0) + Done(2.0) => 5.0 / 10.0 = 50.0%
    t1 = Task(project_id=project.id, title="T1", weight=3.0, status=TaskStatus.DONE.value)
    t2 = Task(project_id=project.id, title="T2", weight=5.0, status=TaskStatus.IN_PROGRESS.value)
    t3 = Task(project_id=project.id, title="T3", weight=2.0, status=TaskStatus.DONE.value)
    pct, comp_w, tot_w = calculate_weighted_progress([t1, t2, t3], project.id)
    assert pct == 50.0
    assert comp_w == 5.0
    assert tot_w == 10.0

    # Negative weight raises ValueError
    bad_task = Task(project_id=project.id, title="Bad", weight=-1.0, status=TaskStatus.TO_DO.value)
    with pytest.raises(ValueError):
        calculate_weighted_progress([bad_task], project.id)


def test_unit_invalid_status_transitions():
    from fastapi import HTTPException

    # Planning -> In Progress is valid
    validate_project_status_transition("Planning", "In Progress")

    # Planning -> Completed directly is invalid
    with pytest.raises(HTTPException) as exc:
        validate_project_status_transition("Planning", "Completed")
    assert exc.value.status_code == 400


def test_completion_gate_evidence_verification_and_reassessment_invalidation(client: TestClient):
    headers = register_and_headers(client, "gate@example.com")

    # 1. Create project and move to In Progress
    p = client.post(
        "/api/projects",
        headers=headers,
        json={
            "name": "Security Audit Portal",
            "description": "Internal security compliance portal",
            "objectives": "Pass all mandatory security checks",
            "status": "In Progress",
            "priority": "High",
        },
    ).json()
    pid = p["id"]

    # 2. Add a mandatory requirement and an optional requirement
    mand_req = client.post(
        f"/api/projects/{pid}/requirements",
        headers=headers,
        json={
            "title": "Argon2id Password Hashing",
            "is_mandatory": True,
            "acceptance_criteria": "Unit test verifies Argon2id hash prefix",
        },
    ).json()
    opt_req = client.post(
        f"/api/projects/{pid}/requirements",
        headers=headers,
        json={
            "title": "Custom Avatar Themes",
            "is_mandatory": False,
            "acceptance_criteria": "Optional UI polish",
        },
    ).json()

    # Unmapped mandatory requirement blocks completion
    gate_resp = client.get(f"/api/projects/{pid}/gate", headers=headers).json()["gate"]
    assert gate_resp["eligible_for_completion"] is False
    assert len(gate_resp["unmapped_mandatory_requirements"]) == 1

    # 3. Create required milestone and mandatory task + optional task
    ms = client.post(
        f"/api/projects/{pid}/milestones",
        headers=headers,
        json={"title": "Security Baseline", "is_required": True},
    ).json()

    mand_task = client.post(
        f"/api/projects/{pid}/tasks",
        headers=headers,
        json={
            "title": "Implement Argon2id hasher",
            "weight": 4.0,
            "milestone_id": ms["id"],
            "requirement_ids": [mand_req["id"]],
        },
    ).json()

    opt_task = client.post(
        f"/api/projects/{pid}/tasks",
        headers=headers,
        json={
            "title": "Add avatar picker",
            "weight": 1.0,
            "requirement_ids": [opt_req["id"]],
        },
    ).json()

    # 4. Mark mandatory task Done (80% weighted progress because optional task is To Do)
    client.patch(f"/api/tasks/{mand_task['id']}", headers=headers, json={"status": "Done"})

    # 5. Add evidence with only a link/description (verification_status='pending')
    # Rule: Never treat a description or link alone as proof that a test passed!
    ev = client.post(
        f"/api/tasks/{mand_task['id']}/evidence",
        headers=headers,
        json={
            "evidence_type": "test_result",
            "description": "pytest test_security.py output",
            "uri": "https://ci.example.local/builds/42",
            "verification_status": "pending",
        },
    ).json()

    gate_pending = client.get(f"/api/projects/{pid}/gate", headers=headers).json()["gate"]
    assert gate_pending["progress_percentage"] == 80.0
    assert gate_pending["eligible_for_completion"] is False
    assert gate_pending["readiness_status"] == "Needs Verification"

    # Attempt completion while evidence is pending -> rejected
    fail_complete = client.post(
        f"/api/projects/{pid}/complete",
        headers=headers,
        json={"confirm_completion": True},
    )
    assert fail_complete.status_code == 400

    # 6. Verify the evidence AND mark mandatory requirement as Satisfied
    client.patch(f"/api/evidence/{ev['id']}", headers=headers, json={"verification_status": "verified"})
    client.patch(f"/api/requirements/{mand_req['id']}", headers=headers, json={"status": "Satisfied"})

    # Even though optional task is still To Do (progress = 80%), project is now Eligible for Completion!
    gate_ready = client.get(f"/api/projects/{pid}/gate", headers=headers).json()["gate"]
    assert gate_ready["eligible_for_completion"] is True
    assert gate_ready["readiness_status"] == "Eligible for Completion"

    # 7. Run an assessment so we can verify staleness later
    assess = client.post(f"/api/projects/{pid}/assessments", headers=headers)
    assert assess.status_code == 201
    assess_id = assess.json()["id"]
    assert assess.json()["is_stale"] is False

    # 8. Complete project requires confirm_completion=True
    no_confirm = client.post(
        f"/api/projects/{pid}/complete",
        headers=headers,
        json={"confirm_completion": False},
    )
    assert no_confirm.status_code == 400

    completed_proj = client.post(
        f"/api/projects/{pid}/complete",
        headers=headers,
        json={"confirm_completion": True, "completion_notes": "All mandatory checks verified."},
    )
    assert completed_proj.status_code == 200
    assert completed_proj.json()["status"] == "Completed"
    assert completed_proj.json()["completed_at"] is not None

    # 9. Reopen mandatory task -> invalidates assessment AND reverts project from Completed to In Progress!
    client.patch(f"/api/tasks/{mand_task['id']}", headers=headers, json={"status": "In Progress"})

    updated_proj = client.get(f"/api/projects/{pid}", headers=headers).json()
    assert updated_proj["status"] == "In Progress"
    assert updated_proj["completed_at"] is None
    assert updated_proj["eligible_for_completion"] is False

    stale_assess = client.get(f"/api/assessments/{assess_id}", headers=headers).json()
    assert stale_assess["is_stale"] is True
    assert stale_assess["invalidated_at"] is not None
