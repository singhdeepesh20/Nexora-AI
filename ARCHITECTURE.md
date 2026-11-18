# NEXORA Architecture

## 1. Repository assessment (Phase 0, 2026-11-18)

The project folder was empty. Notable environment findings that shaped the plan:

* The folder sat inside a git repository rooted at the user's home directory, so NEXORA got its own repository.
* Toolchain: Node 24 (22 LTS is the documented minimum), Python 3.12.2, uv 0.11, Ollama 0.12 installed. **Rust is not installed**, so the Tauri desktop shell (Phase 10) cannot be built yet. pnpm is used through `npx pnpm@9.15.9` (pinned in `packageManager`).
* macOS provides `sandbox-exec`; Linux `bubblewrap` was not available to test on this machine.

## 2. Shape: a local-first modular monolith

```
Browser / (future) Tauri webview
  └─ React + R3F app (apps/web) ──HTTP /api/v1 (loopback, per-launch token)──┐
                                                                             ▼
                                      FastAPI backend (backend/nexora) - one process
   ┌───────────────┬──────────────┬───────────────┬──────────────┬─────────────────┐
   │ Learning eng. │ Simulation   │ Mission eng.  │ Mentor eng.  │ Local storage   │
   │ (curriculum,  │ engine (6    │ (evaluator,   │ (orchestr.,  │ (SQLite+FTS5,   │
   │  mastery,     │  labs, pure  │  quality,     │  agents,     │  workspaces,    │
   │  recs)        │  functions)  │  sandbox) ────┼──────────────┼─ backups)       │
   └───────────────┴──────────────┴───────┬───────┴──────┬───────┴─────────────────┘
                                          ▼              ▼
                       isolated child Python process   optional Ollama on 127.0.0.1
                       (OS sandbox + rlimits + guards)
```

There are no servers besides the app itself: no PostgreSQL, Redis, vector DB, cloud auth or analytics.

### Engines and where they live

| Engine | Location | Interface |
|--------|----------|-----------|
| World engine | `packages/world-engine` (TypeScript, pure functions) | `buildLayout`, `stepPlayer`, `nearestInteractable`, collision helpers. Renderer-independent so a future multiplayer server can validate movement. |
| Learning engine | `backend/nexora/modules/curriculum`, `learning`, `assessments` | `load_catalog`, `concept_states`, `recommendations`, `skill_levels`, `grade` |
| Simulation engine | `backend/nexora/modules/simulations` | `SIMULATIONS` registry: `{config_model (Pydantic), runner(cfg, ctx) -> dict, version}` |
| Mission engine | `backend/nexora/modules/missions` + `workers/sandbox.py` | `evaluate(catalog, mission_id, code)`, `run_python(files, mode, limits)` |
| Mentor engine | `backend/nexora/modules/mentors` + `infrastructure/local_ai` | `MentorEngine.respond(...)`, `ModelProvider` protocol (Ollama implemented) |
| Assessment engine | `backend/nexora/modules/assessments/grader.py` | `grade(assessment, answers)` - pure, deterministic |
| Local storage engine | `backend/nexora/infrastructure/{database,storage}` | SQLAlchemy models + Alembic migrations, `Workspace`, `export_backup` / `read_and_verify` / `import_backup` |

Business logic lives in **one** place - the Python backend - so the browser edition and the future desktop edition share it exactly (the desktop app will run the same backend as a sidecar). The prompt's suggested `packages/learning-engine`, `simulation-engine`, `mentor-engine`, `mission-engine` TypeScript packages were deliberately **not** created: duplicating that logic in TypeScript would create two sources of truth. `packages/shared-types` holds the API types for the frontend.

Dependency injection: `AppContext` (settings, engine, session factory, catalog, model provider, workspace) is built once in `create_app` and injected into routes with FastAPI `Depends`. Engines receive what they need as arguments, so each is unit-testable in isolation (see `backend/tests`).

## 3. Content is data

`content/` is read-only and versioned with the app:

* `curriculum/curriculum.json` - districts, world layout (buildings, doors, spawn, bounds)
* `curriculum/skills.json`
* `concepts/<id>.json` - objectives, prerequisites, examples, linked labs/missions, completion rules, Socratic prompts
* `lessons/<id>.md`, `assessments/<id>.json` (with answer keys and explanations)
* `missions/<id>/{mission.json, starter.py, tests.py}`

`load_catalog` validates referential integrity and that the prerequisite graph is acyclic; CI fails on a broken content edit. At startup the catalog is mirrored into SQLite (catalog tables + an FTS5 index of lesson sections) only when its content hash changes.

## 4. Database design (SQLite, `backend/migrations`)

Student-owned rows use UUID primary keys. Catalog rows use stable slugs (e.g. `ml.gradient_descent`) so progress survives curriculum updates; `progress.concept_id` is intentionally not a foreign key for the same reason.

| Table | Purpose |
|-------|---------|
| students, avatars | Local profile, settings, avatar colours, last world position |
| curriculum, modules, concepts, prerequisites, missions, skills | Mirror of `content/` (rebuilt when content changes) |
| progress | Per student × concept: lesson opened, best score, attempts, mastered_at, last_practiced_at |
| assessments | Every attempt with answers, per-question results, score, assessment version |
| submissions | Every mission submission with code and full evaluation result |
| skill_evidence | Evidence rows linking skills to passing assessments/missions |
| experiments | Every lab run: simulation, engine version, normalised config, result summary |
| projects | Personal laboratory projects (files on disk under the data dir) |
| conversations, conversation_messages, mentor_memory | Mentor history and lightweight memory |
| achievements | Earned achievements |
| content_fts (FTS5) | Search over lesson sections and missions (porter stemming, heading-weighted BM25) |

Foreign keys are enforced (`PRAGMA foreign_keys=ON`) with `ON DELETE CASCADE` from students, WAL journaling is on, and every request runs in one transaction. Migrations run automatically at startup; an existing database is copied to `backups/pre-migrate-*.db` before any upgrade.

## 5. Security model

See [SECURITY.md](SECURITY.md). In short: loopback binding, per-launch token, Host validation (DNS rebinding), no permissive CORS, strict CSP, validated flat file names for workspaces, safe archive extraction, and untrusted code only in an isolated child process whose isolation level is reported to the student honestly.

## 6. Technical risk assessment

| Risk | Impact | Mitigation / status |
|------|--------|---------------------|
| Sandbox strength differs per OS (no OS sandbox on Windows; bubblewrap optional on Linux) | Student code could reach network/files on weaker platforms | Isolation level reported in every result; audit-hook guards + rlimits + timeouts everywhere; Windows Job Objects / AppContainer planned for Phase 11 |
| `sandbox-exec` is deprecated by Apple | Could disappear in a future macOS | Isolated behind `_detect_backend`; falls back gracefully and reports it |
| 3D performance on integrated GPUs | Unplayable campus | Procedural low-poly geometry, instanced trees, presets (low disables shadows, DPR 0.75-1), sub-stepped movement keeps real-time speed at low FPS. Needs measurement on baseline hardware (open item) |
| Bundling Python + scientific stack for desktop (~250 MB) | Large installers | PyTorch kept optional (labs use NumPy); PyInstaller/uv-bundled sidecar planned in Phase 10 |
| Content correctness | Teaching wrong facts | Assessment answer keys are unit-tested via reference solutions; worked numbers in lessons were checked; community review via CONTRIBUTING |
| Monaco bundle size (3.6 MB) | Slow first editor open | Lazy-loaded chunk; campus never pays for it |
| LLM hallucination in mentors | Misleading answers | Retrieval grounding, "say when unsure" instruction, references shown, fallback is deterministic |

## 7. Roadmap

See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for phase-by-phase status and the next milestones.

## 8. Dependency plan

All versions are pinned in `pnpm-lock.yaml` and `backend/uv.lock`.

* Frontend: React 19.1, Three.js 0.180, @react-three/fiber 9.3, drei 10.7, Zustand 5, Tailwind CSS 4.1, lucide-react, Monaco 0.53 (bundled locally via @monaco-editor/react), marked + DOMPurify, Vite 7, Vitest 3, TypeScript 5.9.
* Backend: FastAPI, Pydantic 2, SQLAlchemy 2.0, Alembic, NumPy 2, scikit-learn 1.x (bundled datasets work offline), httpx, platformdirs. PyTorch is an optional extra (`uv sync --extra torch`), not required by any feature.
* Deliberately avoided: drei `<Environment>` presets and troika `<Text>` default fonts (both fetch from CDNs at runtime). Labels use DOM overlays instead.
