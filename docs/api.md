# ProjectPilot AI — REST API Reference

Base URL (local development): `http://localhost:8000/api`
Interactive OpenAPI / Swagger UI: `http://localhost:8000/docs`

All protected endpoints require an `Authorization: Bearer <access_token>` header and verify that the requested resource belongs to the authenticated user.

---

## 1. Authentication
- `POST /api/auth/register`: Register a new user account with Argon2id password hashing and return a JWT bearer token.
- `POST /api/auth/login`: Authenticate with email and password.
- `POST /api/auth/logout`: Revoke the active bearer token `jti` immediately.
- `GET /api/auth/me`: Return the authenticated user's profile.

## 2. Dashboard & Projects
- `GET /api/dashboard`: Calculate real-time dashboard metrics from database records (total projects, projects in progress, projects eligible for completion, projects with blockers, overdue tasks, upcoming deadlines, project progress bars, recent activity, latest AI assessments).
- `GET /api/projects`: List authenticated user's projects (optional `?status=` filter).
- `POST /api/projects`: Create a new project.
- `POST /api/projects/demo`: Seed a realistic demo project (`EdgeTelemetry Microservice v2`) with requirements, milestones, tasks, dependencies, and evidence.
- `GET /api/projects/{project_id}`: Retrieve project summary and deterministic readiness status.
- `PATCH /api/projects/{project_id}`: Update project fields and validate status transitions (direct transition to `Completed` via PATCH is blocked; use `/complete`).
- `DELETE /api/projects/{project_id}`: Permanently delete a project and its child records.
- `GET /api/projects/{project_id}/gate`: Return full deterministic `CompletionGateResult` and top 3 recommended next steps.
- `GET /api/projects/{project_id}/activity`: Return recent project audit logs.
- `POST /api/projects/{project_id}/complete`: Mark an eligible project as `Completed` (requires `{"confirm_completion": true}` and all completion gate checks to pass).

## 3. Requirements
- `GET /api/projects/{project_id}/requirements`: List project requirements and linked task IDs.
- `POST /api/projects/{project_id}/requirements`: Create a mandatory or optional requirement.
- `PATCH /api/requirements/{requirement_id}`: Update requirement details or verification status (`Unmapped`, `In Progress`, `Needs Verification`, `Satisfied`, `Failed`).
- `DELETE /api/requirements/{requirement_id}`: Delete a requirement.

## 4. Tasks & Evidence
- `GET /api/projects/{project_id}/tasks`: List tasks (supports `?status=`, `?priority=`, `?milestone_id=`, `?search=`).
- `POST /api/projects/{project_id}/tasks`: Create a task, link requirements/milestone, and validate task dependencies for cycles.
- `PATCH /api/tasks/{task_id}`: Update task status, weight, hours, requirements, or dependencies. Prevents marking `Done` if prerequisite tasks are incomplete.
- `DELETE /api/tasks/{task_id}`: Delete a task.
- `GET /api/projects/{project_id}/evidence`: List all evidence items across a project's tasks.
- `POST /api/tasks/{task_id}/evidence`: Record evidence on a task (`test_result`, `verification_note`, `documentation_link`, `repository_link`, `deployment_link`, `other`).
- `PATCH /api/evidence/{evidence_id}`: Update evidence or change `verification_status` (`pending`, `verified`, `failed`).
- `DELETE /api/evidence/{evidence_id}`: Delete an evidence record.

## 5. Milestones
- `GET /api/projects/{project_id}/milestones`: List project milestones with deterministically computed status and progress.
- `POST /api/projects/{project_id}/milestones`: Create a milestone.
- `PATCH /api/milestones/{milestone_id}`: Update milestone details.
- `DELETE /api/milestones/{milestone_id}`: Delete a milestone.

## 6. Local AI & Completion Assessments
- `POST /api/projects/{project_id}/ai/generate-tasks`: Generate structured requirements, milestones, and tasks from the project description using local Ollama. Returns suggestions for user review without mutating the database.
- `POST /api/projects/{project_id}/ai/approve-tasks`: Persist user-reviewed and approved suggestions while deduplicating against existing project items.
- `POST /api/projects/{project_id}/assessments`: Run a full completion assessment. Evaluates deterministic progress and completion gate rules, queries local Ollama for structured commentary (or falls back to the deterministic rule engine if Ollama is offline), and saves an immutable state snapshot.
- `GET /api/projects/{project_id}/assessments`: List assessment history for a project (including `is_stale` invalidation flags).
- `GET /api/assessments/{assessment_id}`: Retrieve a specific assessment report.

## 7. System Health
- `GET /api/health`: Check FastAPI service and SQLite connectivity.
- `GET /api/health/ai`: Check local Ollama reachability, configured model availability, and deterministic fallback mode.
