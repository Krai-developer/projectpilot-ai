# ProjectPilot AI — System Architecture

## 1. Core Architectural Principles

1. **Deterministic Truth Over AI Speculation**:
   - Progress percentage (`100 × completed_task_weight / total_task_weight`) and completion gate eligibility are computed strictly in deterministic backend services (`app/services/completion_service.py`).
   - AI is never allowed to calculate or override the authoritative progress percentage or completion readiness status.
2. **Zero Paid AI Dependencies & Graceful Offline Operation**:
   - All AI inference runs locally through **Ollama** (`app/services/ollama_service.py`).
   - No cloud AI SDKs or paid API keys are required or used.
   - When Ollama is offline or unreachable, project tracking, task updates, weighted progress calculation, completion gate checks, and deterministic assessment reports continue to work seamlessly.
3. **Strict Data Ownership & Security**:
   - Passwords are hashed using **Argon2id** (`argon2-cffi`).
   - Short-lived signed JWT bearer tokens include a unique `jti` claim that can be immediately revoked in the `revoked_tokens` table on logout.
   - Every database query in `app/api/deps.py` scopes records by `Project.owner_id == current_user.id`, preventing cross-user access via identifier guessing.
4. **Prompt Injection & Output Validation**:
   - User-provided project descriptions, task titles, and notes are wrapped inside explicit `<PROJECT_DATA>` delimiters and treated as untrusted data.
   - Ollama responses are constrained using JSON Schema (`format`) and validated through Pydantic models plus referential integrity checks (rejecting any hallucinated `task_id`).

---

## 2. Component Layers

```
projectpilot-ai/
├── frontend/               # React 18 + TypeScript + Vite + Tailwind CSS + Recharts
│   ├── src/app/            # Router & ProtectedRoute boundaries
│   ├── src/components/     # Responsive Sidebar Layout & StatusBadges
│   ├── src/features/       # Auth, Dashboard, Projects, ProjectDetail, Global Views
│   ├── src/hooks/          # AuthContext & Dark/Light ThemeContext
│   ├── src/lib/api.ts      # Typed REST client
│   └── e2e/                # Playwright end-to-end browser tests
└── backend/                # Python FastAPI + SQLAlchemy 2.0 + Alembic + SQLite
    ├── app/api/            # REST controllers (auth, projects, requirements, tasks, milestones, ai)
    ├── app/core/           # Settings, SQLite FK pragma engine, Argon2id + JWT security
    ├── app/models/         # SQLAlchemy declarative entities & constraints
    ├── app/schemas/        # Pydantic v2 request/response schemas
    ├── app/services/       # Deterministic completion gate & dedicated local Ollama service
    └── alembic/            # Database schema migrations
```

---

## 3. Completion Gate & Assessment Lifecycle

1. **Weighted Progress Calculation**:
   $$\text{progress} = \frac{100 \times \sum w_{\text{done}}}{\sum w_{\text{all}}}$$
   - Empty projects return `0.0%` without division by zero.
   - All tasks enforce `weight > 0`.
   - Weighted progress measures recorded task completion, not verified product quality.
2. **Completion Gate Eligibility**:
   A project becomes **Eligible for Completion** only when:
   - At least one mandatory requirement is defined and **every mandatory requirement** is mapped to tasks and marked `Satisfied`.
   - **Every required task** (linked to a mandatory requirement or required milestone) is `Done`.
   - **Every required task** has at least one `verified` evidence item (a link or description with `pending` status is never treated as proof that a test passed) and zero `failed` evidence items.
   - No mandatory task is `Blocked` or `In Review`.
   - All required milestones and task dependency prerequisites are satisfied.
   - Optional tasks/requirements do not block completion eligibility.
3. **Explicit User Confirmation & Automatic Invalidation**:
   - Eligibility never auto-completes a project; the user must explicitly submit `confirm_completion=true` to `POST /api/projects/{project_id}/complete`.
   - Any subsequent change to requirements, tasks, milestones, or evidence marks existing assessments as **Stale** (`invalidated_at = utcnow()`) and, if a `Completed` project no longer satisfies the completion gate, automatically reverts the project to `In Progress`.
