from fastapi.testclient import TestClient

from app.api.ai_assessments import get_ollama_service
from app.main import app
from app.schemas.schemas import (
    GeneratedMilestoneItem,
    GeneratedRequirementItem,
    GeneratedTaskItem,
    NextStepRecommendation,
    StructuredAIAssessmentOutput,
)
from app.services.ollama_service import (
    OllamaLocalService,
    OllamaServiceError,
    RawGeneratedPlanPayload,
)
from app.tests.test_phase2_auth_crud import register_and_headers


def test_ai_task_generation_review_and_duplicate_prevention(client: TestClient):
    headers = register_and_headers(client, "ai-gen@example.com")
    proj = client.post(
        "/api/projects",
        headers=headers,
        json={
            "name": "Local Analytics Engine",
            "description": "Fast local analytics pipeline with DuckDB and FastAPI",
            "objectives": "Sub-second query latency",
        },
    ).json()
    pid = proj["id"]

    class MockSuccessOllama(OllamaLocalService):
        async def generate_project_plan_suggestions(self, **kwargs):
            payload = RawGeneratedPlanPayload(
                requirements=[
                    GeneratedRequirementItem(
                        title="DuckDB Query Execution",
                        description="Execute parameterized analytical SQL",
                        is_mandatory=True,
                        acceptance_criteria="Query latency < 200ms",
                    )
                ],
                milestones=[
                    GeneratedMilestoneItem(
                        title="Storage Layer Ready",
                        description="Core storage engine initialized",
                        is_required=True,
                    )
                ],
                tasks=[
                    GeneratedTaskItem(
                        title="Configure DuckDB connection pool",
                        description="Set up read-only and read-write connections",
                        priority="High",
                        weight=3.0,
                        estimated_hours=4.0,
                        linked_requirement_titles=["DuckDB Query Execution"],
                        milestone_title="Storage Layer Ready",
                        acceptance_notes="Unit tests pass",
                    ),
                    # Intentional duplicate title in same response to test deduplication
                    GeneratedTaskItem(
                        title="Configure DuckDB connection pool",
                        description="Duplicate item",
                        priority="High",
                        weight=3.0,
                        estimated_hours=4.0,
                    ),
                ],
            )
            return payload, "llama3.2:3b-mock"

    app.dependency_overrides[get_ollama_service] = lambda: MockSuccessOllama()
    try:
        gen_resp = client.post(
            f"/api/projects/{pid}/ai/generate-tasks",
            headers=headers,
            json={"focus_area": "Storage layer"},
        )
        assert gen_resp.status_code == 200
        body = gen_resp.json()
        assert body["ai_used"] is True
        assert len(body["requirements"]) == 1
        assert len(body["milestones"]) == 1
        assert len(body["tasks"]) == 1  # Deduplicated!

        # Nothing is saved to DB until user approves!
        assert len(client.get(f"/api/projects/{pid}/tasks", headers=headers).json()) == 0

        # User approves suggestions
        approve_1 = client.post(
            f"/api/projects/{pid}/ai/approve-tasks",
            headers=headers,
            json={
                "requirements": body["requirements"],
                "milestones": body["milestones"],
                "tasks": body["tasks"],
            },
        )
        assert approve_1.status_code == 201
        assert approve_1.json()["created_tasks"] == 1
        assert approve_1.json()["skipped_duplicates"] == 0

        # Retrying approval with same items skips duplicates instead of creating duplicate tasks!
        approve_2 = client.post(
            f"/api/projects/{pid}/ai/approve-tasks",
            headers=headers,
            json={
                "requirements": body["requirements"],
                "milestones": body["milestones"],
                "tasks": body["tasks"],
            },
        )
        assert approve_2.status_code == 201
        assert approve_2.json()["created_tasks"] == 0
        assert approve_2.json()["skipped_duplicates"] == 3
    finally:
        app.dependency_overrides.pop(get_ollama_service, None)


def test_ollama_unavailable_and_malformed_output_handling(client: TestClient):
    headers = register_and_headers(client, "ai-errors@example.com")
    proj = client.post(
        "/api/projects",
        headers=headers,
        json={"name": "Resilience Project", "description": "Testing AI error handling"},
    ).json()
    pid = proj["id"]

    # 1. Ollama unavailable -> 503 on task generation, deterministic fallback on assessment
    class MockUnavailableOllama(OllamaLocalService):
        async def generate_project_plan_suggestions(self, **kwargs):
            raise OllamaServiceError("Local Ollama service is unavailable at http://localhost:11434")

        async def generate_completion_assessment_commentary(self, **kwargs):
            raise OllamaServiceError("Local Ollama service is unavailable at http://localhost:11434")

    app.dependency_overrides[get_ollama_service] = lambda: MockUnavailableOllama()
    try:
        gen_fail = client.post(
            f"/api/projects/{pid}/ai/generate-tasks",
            headers=headers,
            json={},
        )
        assert gen_fail.status_code == 503

        # Assessment with default fallback succeeds using deterministic rule engine
        assess_fallback = client.post(f"/api/projects/{pid}/assessments", headers=headers)
        assert assess_fallback.status_code == 201
        data = assess_fallback.json()
        assert data["model_name"] == "deterministic-rule-engine"
        assert data["findings"]["ai_used"] is False
        assert "unavailable" in (data["findings"]["ai_error"] or "").lower()

        # Assessment with require_ai=true returns 503
        assess_strict = client.post(f"/api/projects/{pid}/assessments?require_ai=true", headers=headers)
        assert assess_strict.status_code == 503
    finally:
        app.dependency_overrides.pop(get_ollama_service, None)

    # 2. Malformed AI output -> 502 Bad Gateway when require_ai=true or on task generation
    class MockMalformedOllama(OllamaLocalService):
        async def generate_project_plan_suggestions(self, **kwargs):
            raise OllamaServiceError("Local Ollama returned malformed JSON output: Expecting value")

        async def generate_completion_assessment_commentary(self, **kwargs):
            raise OllamaServiceError("AI referenced non-existent or unauthorized task_id=999999.")

    app.dependency_overrides[get_ollama_service] = lambda: MockMalformedOllama()
    try:
        gen_malformed = client.post(
            f"/api/projects/{pid}/ai/generate-tasks",
            headers=headers,
            json={},
        )
        assert gen_malformed.status_code == 502
        assert "malformed JSON" in gen_malformed.json()["detail"]

        assess_malformed_strict = client.post(
            f"/api/projects/{pid}/assessments?require_ai=true", headers=headers
        )
        assert assess_malformed_strict.status_code == 502
        assert "non-existent or unauthorized task_id" in assess_malformed_strict.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_ollama_service, None)


def test_ai_completion_assessment_with_valid_structured_output(client: TestClient):
    headers = register_and_headers(client, "ai-assess@example.com")
    proj = client.post(
        "/api/projects",
        headers=headers,
        json={"name": "AI Audited Project", "description": "Full assessment check"},
    ).json()
    pid = proj["id"]

    req = client.post(
        f"/api/projects/{pid}/requirements",
        headers=headers,
        json={"title": "Core API", "is_mandatory": True},
    ).json()
    task = client.post(
        f"/api/projects/{pid}/tasks",
        headers=headers,
        json={"title": "Build endpoint", "weight": 5.0, "requirement_ids": [req["id"]]},
    ).json()

    class MockValidAssessmentOllama(OllamaLocalService):
        async def generate_completion_assessment_commentary(self, assessment_input, valid_task_ids):
            assert task["id"] in valid_task_ids
            return (
                StructuredAIAssessmentOutput(
                    overall_summary="Project is at 0% completion. Complete 'Build endpoint' and verify evidence.",
                    recommended_next_actions=[
                        NextStepRecommendation(
                            task_id=task["id"],
                            title="Build endpoint",
                            priority="High",
                            why_it_matters="Required by mandatory requirement 'Core API'.",
                            action_type="task_execution",
                        )
                    ],
                    limitations_or_uncertainties=["No test evidence has been uploaded yet."],
                ),
                "llama3.2:3b",
            )

    app.dependency_overrides[get_ollama_service] = lambda: MockValidAssessmentOllama()
    try:
        resp = client.post(f"/api/projects/{pid}/assessments", headers=headers)
        assert resp.status_code == 201
        body = resp.json()
        assert body["model_name"] == "llama3.2:3b"
        assert body["findings"]["ai_used"] is True
        assert body["findings"]["recorded_progress_percentage"] == 0.0
        assert len(body["findings"]["recommended_next_actions"]) == 1
        assert body["findings"]["recommended_next_actions"][0]["task_id"] == task["id"]
    finally:
        app.dependency_overrides.pop(get_ollama_service, None)
