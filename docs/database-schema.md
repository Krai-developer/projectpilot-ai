# ProjectPilot AI — Database Schema

ProjectPilot AI uses **SQLAlchemy 2.0** and **Alembic** migrations (`backend/alembic/versions/0001_initial_schema.py`). Foreign key enforcement (`PRAGMA foreign_keys=ON`) is enabled on every SQLite connection. All timestamps are stored in UTC.

## Entities & Relationships

### 1. `users`
| Column | Type | Constraints |
|---|---|---|
| `id` | Integer | Primary Key, Indexed |
| `email` | String(255) | Unique, Indexed, Not Null |
| `full_name` | String(255) | Not Null |
| `password_hash` | String(512) | Not Null (Argon2id hash) |
| `created_at` | DateTime(UTC) | Not Null |
| `updated_at` | DateTime(UTC) | Not Null |

### 2. `revoked_tokens`
| Column | Type | Constraints |
|---|---|---|
| `id` | Integer | Primary Key |
| `jti` | String(128) | Unique, Indexed, Not Null |
| `revoked_at` | DateTime(UTC) | Not Null |

### 3. `projects`
| Column | Type | Constraints |
|---|---|---|
| `id` | Integer | Primary Key, Indexed |
| `owner_id` | Integer | FK -> `users.id` (`ON DELETE CASCADE`), Indexed |
| `name` | String(255) | Not Null |
| `description` | Text | Not Null |
| `objectives` | Text | Not Null |
| `completion_criteria` | Text | Not Null |
| `status` | String(50) | `Planning`, `In Progress`, `Blocked`, `Ready for Review`, `Completed`, `Archived` |
| `priority` | String(50) | `Low`, `Medium`, `High`, `Critical` |
| `start_date` | Date | Nullable |
| `deadline` | Date | Nullable, Indexed |
| `created_at` | DateTime(UTC) | Not Null |
| `updated_at` | DateTime(UTC) | Not Null |
| `completed_at` | DateTime(UTC) | Nullable |

### 4. `requirements`
| Column | Type | Constraints |
|---|---|---|
| `id` | Integer | Primary Key, Indexed |
| `project_id` | Integer | FK -> `projects.id` (`ON DELETE CASCADE`), Indexed |
| `title` | String(255) | Not Null |
| `description` | Text | Not Null |
| `is_mandatory` | Boolean | Not Null (default `True`) |
| `acceptance_criteria` | Text | Not Null |
| `verification_notes` | Text | Not Null |
| `status` | String(50) | `Unmapped`, `In Progress`, `Needs Verification`, `Satisfied`, `Failed` |
| `created_at` | DateTime(UTC) | Not Null |
| `updated_at` | DateTime(UTC) | Not Null |

### 5. `milestones`
| Column | Type | Constraints |
|---|---|---|
| `id` | Integer | Primary Key, Indexed |
| `project_id` | Integer | FK -> `projects.id` (`ON DELETE CASCADE`), Indexed |
| `title` | String(255) | Not Null |
| `description` | Text | Not Null |
| `due_date` | Date | Nullable, Indexed |
| `is_required` | Boolean | Not Null (default `True`) |
| `status` | String(50) | `Pending`, `In Progress`, `Blocked`, `Completed` |
| `created_at` | DateTime(UTC) | Not Null |
| `updated_at` | DateTime(UTC) | Not Null |

### 6. `tasks`
| Column | Type | Constraints |
|---|---|---|
| `id` | Integer | Primary Key, Indexed |
| `project_id` | Integer | FK -> `projects.id` (`ON DELETE CASCADE`), Indexed |
| `milestone_id` | Integer | FK -> `milestones.id` (`ON DELETE SET NULL`), Nullable |
| `title` | String(255) | Not Null |
| `description` | Text | Not Null |
| `status` | String(50) | `To Do`, `In Progress`, `Blocked`, `In Review`, `Done` |
| `priority` | String(50) | `Low`, `Medium`, `High`, `Critical` |
| `weight` | Float | `CHECK (weight > 0)`, Not Null |
| `estimated_hours` | Float | `CHECK (estimated_hours >= 0)`, Not Null |
| `actual_hours` | Float | `CHECK (actual_hours >= 0)`, Not Null |
| `due_date` | Date | Nullable, Indexed |
| `notes` | Text | Not Null |
| `completed_at` | DateTime(UTC) | Nullable |
| `created_at` | DateTime(UTC) | Not Null |
| `updated_at` | DateTime(UTC) | Not Null |

### 7. `task_requirements` (Composite Join Table)
- `task_id`: FK -> `tasks.id` (`ON DELETE CASCADE`), Primary Key
- `requirement_id`: FK -> `requirements.id` (`ON DELETE CASCADE`), Primary Key

### 8. `task_dependencies` (Directed Acyclic Prerequisite Graph)
- `task_id`: FK -> `tasks.id` (`ON DELETE CASCADE`), Primary Key
- `depends_on_task_id`: FK -> `tasks.id` (`ON DELETE CASCADE`), Primary Key
- Constraint: `CHECK (task_id != depends_on_task_id)` plus application-level DFS cycle detection.

### 9. `task_evidence`
| Column | Type | Constraints |
|---|---|---|
| `id` | Integer | Primary Key, Indexed |
| `task_id` | Integer | FK -> `tasks.id` (`ON DELETE CASCADE`), Indexed |
| `evidence_type` | String(50) | `test_result`, `verification_note`, `documentation_link`, `repository_link`, `deployment_link`, `other` |
| `description` | Text | Not Null |
| `uri` | String(1024) | Not Null |
| `verification_status` | String(50) | `pending`, `verified`, `failed` |
| `verified_at` | DateTime(UTC) | Nullable |
| `created_at` | DateTime(UTC) | Not Null |

### 10. `assessments`
| Column | Type | Constraints |
|---|---|---|
| `id` | Integer | Primary Key, Indexed |
| `project_id` | Integer | FK -> `projects.id` (`ON DELETE CASCADE`), Indexed |
| `progress_snapshot` | Float | Not Null |
| `readiness_status` | String(50) | `In Progress`, `Not Ready`, `Needs Verification`, `Eligible for Completion`, `Completed` |
| `ai_summary` | Text | Not Null |
| `findings_json` | Text(JSON) | Structured findings report |
| `state_snapshot_json` | Text(JSON) | Recorded project state snapshot |
| `model_name` | String(128) | Local Ollama model name or `deterministic-rule-engine` |
| `created_at` | DateTime(UTC) | Not Null |
| `invalidated_at` | DateTime(UTC) | Nullable (set automatically when project state changes) |

### 11. `activity_logs`
| Column | Type | Constraints |
|---|---|---|
| `id` | Integer | Primary Key, Indexed |
| `project_id` | Integer | FK -> `projects.id` (`ON DELETE CASCADE`), Indexed |
| `task_id` | Integer | FK -> `tasks.id` (`ON DELETE SET NULL`), Nullable |
| `action` | String(128) | Not Null |
| `details_json` | Text(JSON) | Not Null |
| `created_at` | DateTime(UTC) | Not Null |
