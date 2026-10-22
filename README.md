# ProjectPilot AI

**ProjectPilot AI** is a complete, production-minded project tracking and AI completion assessment web application. It solves the core engineering question:

> *"When I am working on a project, I often don't know whether it is actually finished, what work remains, or whether I have satisfied all the requirements."*

ProjectPilot AI combines **deterministic backend completion gates and weighted progress tracking** with **100% local AI inference via Ollama**—requiring **zero paid cloud AI API keys or subscriptions**.

---

## Key Capabilities

- **Authoritative Weighted Progress Calculation**:
  Calculated strictly in the backend (`progress = 100 × completed_task_weight / total_task_weight`), safely handling empty projects and validating positive weights. Weighted progress reflects recorded task completion, while the Completion Gate verifies product readiness.
- **Deterministic Completion Gate**:
  Distinguishes between `In Progress`, `Not Ready`, `Needs Verification`, `Eligible for Completion`, and `Completed`. Blocks premature completion until:
  1. Every mandatory requirement is mapped to tasks and marked `Satisfied`.
  2. Every required task is `Done`.
  3. Every required task has at least one `verified` evidence item (links or notes with `pending` status are never treated as proof that a test passed) and zero `failed` evidence items.
  4. No mandatory task is `Blocked` or `In Review`.
  5. All required milestones and task dependency prerequisites are satisfied.
- **Explicit Completion Confirmation & Automatic Reassessment Invalidation**:
  Eligibility never auto-completes a project; explicit user confirmation (`confirm_completion=true`) is required. If a mandatory requirement or required task changes after an assessment or completion, previous assessments are automatically marked **Stale** and a completed project reverts to `In Progress` for reassessment.
- **Local Ollama AI Integration (With Full Offline Fallback)**:
  - **AI Task & Plan Generation**: Generates structured requirements, milestones, and tasks constrained by a JSON Schema and presents them in a review/edit modal before saving, with automatic duplicate prevention.
  - **AI Completion Assessment & Next 3 Actions**: Audits actual project records without inventing work or overriding deterministic progress. When Ollama is unavailable, ProjectPilot AI remains 100% functional using its deterministic rule engine.

---

## 1. Required Software & Supported Versions

| Tool | Supported Version | Cost |
|---|---|---|
| **Python** | `3.11+` (tested on Python `3.13`) | Free / Open Source |
| **Node.js & npm** | Node `20+` / `22+`, npm `10+` | Free / Open Source |
| **SQLite** | `3.35+` (bundled with Python) | Free / Open Source |
| **Ollama** *(Optional for AI commentary)* | Latest local release (`0.3+`) | Free Local Inference |

---

## 2. Ollama Installation & Hardware-Appropriate Model Selection

ProjectPilot AI runs all AI inference locally via [Ollama](https://ollama.com) and works without Ollama using deterministic rules.

### Install Ollama
- **Windows**: Download the installer from `https://ollama.com/download/windows` or run `winget install Ollama.Ollama`.
- **macOS**: Download from `https://ollama.com/download/mac` or run `brew install --cask ollama`.
- **Linux**: Run `curl -fsSL https://ollama.com/install.sh | sh`.

### Choose a Model Based on Your Hardware
Do not assume every machine can run a large parameter model. Select a model appropriate for your available RAM/VRAM and set `OLLAMA_MODEL` in `.env`:

| Hardware Tier | Available RAM / VRAM | Recommended `OLLAMA_MODEL` | Pull Command |
|---|---|---|---|
| **Lightweight / CPU-only Laptop** | 8 GB RAM | `llama3.2:1b` or `qwen2.5:1.5b` | `ollama pull llama3.2:1b` |
| **Standard Developer Machine (Default)** | 16 GB RAM / 4–6 GB VRAM | `llama3.2:3b` | `ollama pull llama3.2:3b` |
| **Workstation / Dedicated GPU** | 24+ GB RAM / 8+ GB VRAM | `llama3.1:8b` or `qwen2.5-coder:7b` | `ollama pull llama3.1:8b` |

### Verify Local Ollama Availability
```powershell
ollama list
curl http://localhost:11434/api/tags
```

---

## 3. Environment Variables

Copy `.env.example` to `.env` in the repository root (or inside `backend/`):

```powershell
Copy-Item .env.example .env
```

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./projectpilot.db` | Local SQLite database path |
| `SECRET_KEY` | `change-this-in-production...` | Secret key for signing HS256 JWT tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `120` | Token expiration lifetime in minutes |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed frontend origins |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Local Ollama HTTP API base URL |
| `OLLAMA_MODEL` | `llama3.2:3b` | Local Ollama model tag |
| `OLLAMA_TIMEOUT_SECONDS` | `45` | Request timeout for local inference |
| `VITE_API_BASE_URL` | `http://localhost:8000/api` | Backend REST URL used by the React frontend |

---

## 4. Step-by-Step Local Setup & Running the Application

### A. Backend Setup & Database Migrations

**Windows (PowerShell):**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -e ".[dev]"
.\.venv\Scripts\alembic upgrade head
```

**Linux / macOS (Bash):**
```bash
cd backend
python3 -m venv .venv
./.venv/bin/pip install -e ".[dev]"
./.venv/bin/alembic upgrade head
```

### B. Frontend Setup

```powershell
cd frontend
npm install
```

### C. Starting Backend & Frontend

**Terminal 1 — Start FastAPI Backend (`http://localhost:8000`):**
```powershell
cd backend
.\.venv\Scripts\uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — Start React Vite Frontend (`http://localhost:5173`):**
```powershell
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 5. Creating a Demo Project

You can create the pre-configured **EdgeTelemetry Microservice v2** demo project in two ways:

1. **In the Web UI**: Register/sign in and click **"Load Demo Project"** on the Dashboard.
2. **Via CLI Script**:
   ```powershell
   .\backend\.venv\Scripts\python scripts/seed_demo.py
   ```
   This creates `demo@projectpilot.local` (password: `DemoPass123!`) and populates a realistic project with mandatory/optional requirements, milestones, weighted tasks, dependencies, and verified/pending evidence.

---

## 6. Running Automated Tests

```powershell
# 1. Backend Unit & Integration Tests (pytest)
cd backend
.\.venv\Scripts\pytest -v

# 2. Frontend Component & Interaction Tests (Vitest + React Testing Library)
cd ..\frontend
npm test

# 3. End-to-End Browser Workflow Tests (Playwright)
npm run test:e2e
```

---

## 7. Backing Up and Restoring Data

Use the included SQLite online backup script (`scripts/backup_restore.py`) to safely snapshot or restore your database without corruption:

```powershell
# Create a backup
python scripts/backup_restore.py backup backend/projectpilot.db backups/projectpilot_backup.db

# Restore from a backup
python scripts/backup_restore.py restore backups/projectpilot_backup.db backend/projectpilot.db
```

---

## 8. Troubleshooting Common Errors

- **`Local Ollama service unreachable at http://localhost:11434`**:
  Ollama is not running or has not been installed yet. ProjectPilot AI will automatically continue in **deterministic mode**. To enable AI commentary, run `ollama serve` and `ollama pull llama3.2:3b`, then click **Refresh Diagnostics** on the Settings page.
- **`Cannot mark task as Done while prerequisite task(s) are incomplete`**:
  The task depends on one or more prerequisite tasks that are not yet `Done`. Complete the prerequisite tasks first or update the task's dependencies.
- **`Project does not satisfy all mandatory completion gate criteria`**:
  Inspect the **Deterministic Completion Gate** card on the Project Overview tab. Ensure all mandatory requirements are mapped to tasks and marked `Satisfied`, all required tasks are `Done`, and each required task has at least one `verified` evidence item.

---

## 9. Hosting & Deployment Cost Disclaimer

- **Local Development & Execution**: 100% free. Uses local SQLite, local FastAPI, local Vite, and local Ollama.
- **Optional Public Deployment Notice**: Deploying the frontend, backend, or a GPU-backed container to a public cloud provider (such as AWS, GCP, Fly.io, or Render) may incur hosting or compute infrastructure costs. Furthermore, a local Ollama instance running on `http://localhost:11434` on your personal computer is **not** automatically accessible to remote cloud servers.

---

## Additional Documentation
- [System Architecture](docs/architecture.md)
- [Database Schema](docs/database-schema.md)
- [REST API Reference](docs/api.md)
- [Testing Guide](docs/testing.md)
