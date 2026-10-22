# ProjectPilot AI — Testing Guide

ProjectPilot AI includes three tiers of automated tests:
1. **Backend Unit & Integration Tests (`pytest` + `httpx`)**
2. **Frontend Component & Interaction Tests (`vitest` + `@testing-library/react`)**
3. **End-to-End Browser Workflow Tests (`@playwright/test`)**

---

## 1. Running Backend Tests

From the `backend/` directory:

```powershell
.\.venv\Scripts\pytest -v
```

### What Backend Tests Cover
- **`test_phase1_setup.py`**:
  - Database schema & table creation (`users`, `revoked_tokens`, `projects`, `requirements`, `milestones`, `tasks`, `task_requirements`, `task_dependencies`, `task_evidence`, `assessments`, `activity_logs`)
  - Check constraints (`weight > 0`, `task_id != depends_on_task_id`)
  - `/api/health` and `/api/health/ai` graceful offline behavior
- **`test_phase2_auth_crud.py`**:
  - Registration, Argon2id login verification, `/api/auth/me`, and token revocation on `/api/auth/logout`
  - Strict cross-user data isolation (User B receives HTTP 404 when attempting to read, patch, or delete User A's projects, requirements, milestones, or tasks)
  - Project, Requirement, Milestone, and Task CRUD
  - Prevention of circular task dependencies (DFS cycle detection) and prevention of marking a task `Done` while prerequisites are incomplete
  - Verification that past due dates never auto-complete a milestone
- **`test_phase3_progress_and_gate.py`**:
  - Unit tests for weighted progress calculation (`100 * completed_weight / total_weight`) and empty project division-by-zero safety
  - Invalid project status transition rejection
  - Mandatory requirement mapping & satisfaction rules
  - Verification that evidence links/descriptions with `verification_status="pending"` do NOT satisfy completion checks until explicitly marked `verified`
  - Verification that optional tasks/requirements do not block completion eligibility
  - Explicit confirmation requirement (`confirm_completion=true`) on `/complete`
  - Automatic invalidation of assessments (`is_stale=true`) and automatic reversion of `Completed` status when a mandatory task is reopened
- **`test_phase4_ai_ollama.py`**:
  - Mocked local Ollama structured task generation, review-before-save isolation, and duplicate task prevention on retry
  - Ollama unavailable handling (`503 Service Unavailable` on task generation; deterministic fallback report on assessment)
  - Malformed AI JSON and hallucinated `task_id` rejection (`502 Bad Gateway`)
- **`test_live_ollama_optional.py`**:
  - Optional live integration test against a running local Ollama instance. Run with:
    ```powershell
    $env:RUN_LIVE_OLLAMA_TESTS="1"
    .\.venv\Scripts\pytest -v app/tests/test_live_ollama_optional.py
    ```

---

## 2. Running Frontend Unit & Component Tests

From the `frontend/` directory:

```powershell
npm test
```

### What Frontend Tests Cover (`src/tests/app.test.tsx`)
- Authentication form validation (invalid email and short password alerts)
- Dashboard loading state, error recovery state, and rendering of database metrics & progress bars
- Project Detail progress display, task status selector changes (`PATCH /api/tasks/{id}`), and Assessment History rendering with `Stale` badges

---

## 3. Running End-to-End Playwright Tests

From the `frontend/` directory:

```powershell
npm run test:e2e
```

### What E2E Tests Cover (`e2e/projectpilot.spec.ts`)
1. Register a new user account and land on the dashboard
2. Create a new project (`Autonomous Drone Telemetry`)
3. Add a mandatory requirement and verify the `Unmapped Mandatory Requirement` flag
4. Create a weighted task mapped to the mandatory requirement
5. Run an assessment and inspect incomplete work findings
6. Mark the required task `Done`, record `verified` test evidence, and mark the mandatory requirement `Satisfied`
7. Complete the project via the explicit confirmation modal
8. Reopen the mandatory task and verify that progress updates and the previous assessment is marked `Stale`
