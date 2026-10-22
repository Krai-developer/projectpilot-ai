from fastapi.testclient import TestClient


def register_and_headers(client: TestClient, email: str, password: str = "SecurePass123!") -> dict:
    resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "full_name": "Test User"},
    )
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_auth_registration_login_me_and_logout_revocation(client: TestClient):
    # Register
    reg = client.post(
        "/api/auth/register",
        json={"email": "alice@example.com", "password": "StrongPassword123!", "full_name": "Alice Dev"},
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Duplicate email fails
    dup = client.post(
        "/api/auth/register",
        json={"email": "ALICE@example.com", "password": "StrongPassword123!"},
    )
    assert dup.status_code == 409

    # Login
    login = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "StrongPassword123!"},
    )
    assert login.status_code == 200
    assert "access_token" in login.json()

    # Wrong password
    bad_login = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "WrongPassword999"},
    )
    assert bad_login.status_code == 401

    # Me endpoint
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "alice@example.com"

    # Logout revokes token
    logout = client.post("/api/auth/logout", headers=headers)
    assert logout.status_code == 200
    me_after = client.get("/api/auth/me", headers=headers)
    assert me_after.status_code == 401


def test_cross_user_data_isolation(client: TestClient):
    alice_headers = register_and_headers(client, "alice-iso@example.com")
    bob_headers = register_and_headers(client, "bob-iso@example.com")

    # Alice creates a project, requirement, milestone, and task
    p_resp = client.post(
        "/api/projects",
        headers=alice_headers,
        json={
            "name": "Alice Confidential Project",
            "description": "Private project",
            "objectives": "Keep isolated",
            "priority": "High",
        },
    )
    assert p_resp.status_code == 201
    project_id = p_resp.json()["id"]

    r_resp = client.post(
        f"/api/projects/{project_id}/requirements",
        headers=alice_headers,
        json={"title": "Secret Req", "is_mandatory": True, "acceptance_criteria": "Pass"},
    )
    req_id = r_resp.json()["id"]

    m_resp = client.post(
        f"/api/projects/{project_id}/milestones",
        headers=alice_headers,
        json={"title": "Secret Milestone", "is_required": True},
    )
    ms_id = m_resp.json()["id"]

    t_resp = client.post(
        f"/api/projects/{project_id}/tasks",
        headers=alice_headers,
        json={"title": "Secret Task", "weight": 2.0, "requirement_ids": [req_id], "milestone_id": ms_id},
    )
    task_id = t_resp.json()["id"]

    # Bob cannot read, update, or delete any of Alice's records by ID
    assert client.get(f"/api/projects/{project_id}", headers=bob_headers).status_code == 404
    assert client.patch(f"/api/projects/{project_id}", headers=bob_headers, json={"name": "Hacked"}).status_code == 404
    assert client.delete(f"/api/projects/{project_id}", headers=bob_headers).status_code == 404
    assert client.get(f"/api/projects/{project_id}/requirements", headers=bob_headers).status_code == 404
    assert client.patch(f"/api/requirements/{req_id}", headers=bob_headers, json={"title": "Hacked"}).status_code == 404
    assert client.patch(f"/api/milestones/{ms_id}", headers=bob_headers, json={"title": "Hacked"}).status_code == 404
    assert client.patch(f"/api/tasks/{task_id}", headers=bob_headers, json={"title": "Hacked"}).status_code == 404
    assert client.delete(f"/api/tasks/{task_id}", headers=bob_headers).status_code == 404


def test_project_requirement_milestone_and_task_crud(client: TestClient):
    headers = register_and_headers(client, "crud@example.com")

    # Create project
    p = client.post(
        "/api/projects",
        headers=headers,
        json={
            "name": "Payment Gateway Integration",
            "description": "Build resilient checkout flow",
            "objectives": "Zero duplicate charges",
            "completion_criteria": "All webhook tests pass",
            "status": "Planning",
            "priority": "Critical",
            "start_date": "2026-10-01",
            "deadline": "2026-11-15",
        },
    ).json()
    pid = p["id"]

    # Update project status to In Progress
    upd = client.patch(f"/api/projects/{pid}", headers=headers, json={"status": "In Progress"})
    assert upd.status_code == 200
    assert upd.json()["status"] == "In Progress"

    # Invalid direct status patch to Completed is rejected
    bad_complete = client.patch(f"/api/projects/{pid}", headers=headers, json={"status": "Completed"})
    assert bad_complete.status_code == 400

    # Create requirement
    req = client.post(
        f"/api/projects/{pid}/requirements",
        headers=headers,
        json={
            "title": "Idempotent Webhook Handler",
            "description": "Deduplicate event IDs",
            "is_mandatory": True,
            "acceptance_criteria": "Integration test verifies 200 OK on replay",
        },
    )
    assert req.status_code == 201
    req_id = req.json()["id"]

    # Create milestone
    ms = client.post(
        f"/api/projects/{pid}/milestones",
        headers=headers,
        json={
            "title": "Core API Milestone",
            "description": "Backend handlers ready",
            "due_date": "2020-01-01",  # Past due date must NOT auto-complete milestone!
            "is_required": True,
        },
    )
    assert ms.status_code == 201
    assert ms.json()["status"] == "Pending"
    ms_id = ms.json()["id"]

    # Create tasks
    t1 = client.post(
        f"/api/projects/{pid}/tasks",
        headers=headers,
        json={
            "title": "Design event table",
            "weight": 2.0,
            "priority": "High",
            "milestone_id": ms_id,
            "requirement_ids": [req_id],
        },
    )
    assert t1.status_code == 201
    t1_id = t1.json()["id"]

    t2 = client.post(
        f"/api/projects/{pid}/tasks",
        headers=headers,
        json={
            "title": "Implement webhook endpoint",
            "weight": 3.0,
            "priority": "Critical",
            "milestone_id": ms_id,
            "requirement_ids": [req_id],
            "dependency_ids": [t1_id],
        },
    )
    assert t2.status_code == 201
    t2_id = t2.json()["id"]
    assert t2.json()["incomplete_prerequisite_ids"] == [t1_id]

    # Cannot mark t2 Done before prerequisite t1 is Done
    premature_done = client.patch(f"/api/tasks/{t2_id}", headers=headers, json={"status": "Done"})
    assert premature_done.status_code == 400

    # Circular dependency check: t1 cannot depend on t2
    cycle_resp = client.patch(f"/api/tasks/{t1_id}", headers=headers, json={"dependency_ids": [t2_id]})
    assert cycle_resp.status_code == 400
    assert "Circular task dependency" in cycle_resp.json()["detail"]
