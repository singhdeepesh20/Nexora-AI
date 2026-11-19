# NEXORA - Implementation status

_Last updated: 2026-11-19 · version 0.2.0 (engagement slice) · v0.1 pushed to GitHub; v0.2 work not yet committed_

## Milestone report - first vertical slice

### Phase status

| Phase | Status | Notes |
|-------|--------|-------|
| 0 Repository audit & architecture | ✅ done | ARCHITECTURE.md (assessment, design, DB, risks, dependency plan) |
| 1 Foundation & playable campus | ✅ done | Procedural campus, avatar, camera, collision, interactions, presets, minimap |
| 2 Profiles & local persistence | ✅ done | SQLite + Alembic, profiles, avatar state, settings, restart persistence |
| 3 Learning engine | ✅ done (districts 1-3) | 12 concepts; districts 4-8 are gates with subject lists only |
| 4 Maths & ML simulations | ✅ done | Gradient descent, ML lab |
| 5 DL & GenAI laboratories | ✅ done | Neural network, transformer (toy, labelled), RAG (lexical BM25). Optional embedding retrieval not built |
| 6 Local AI mentor | ✅ done | 8 personas, 4 agent modes + orchestrator, FTS grounding, Ollama adapter, deterministic fallback. Not tested against a live Ollama model |
| 7 Engineering missions | ✅ done | 5 missions, hidden tests, weighted scoring, quality analysis |
| 8 Code editor & isolated execution | ✅ macOS / 🟡 Linux / ⚠️ Windows | Monaco offline; sandbox strong on macOS, bwrap path untested, Windows basic |
| 9 Skill verification & research | 🟡 partial | Skills + evidence + experiment history + research-mentor template. No research/paper-reproduction environment yet |
| 10 Desktop & browser packaging | 🟡 browser only | `pnpm start`. Tauri shell not started (Rust missing); no installers |
| 11 Security & performance | 🟡 partial | Local API hardening done; needs FPS measurement on baseline hardware, Windows sandbox, dependency audit in CI |
| 12 Release & publication | ⏳ not started | Repo initialised locally; not pushed, nothing committed |

### Definition-of-complete checklist (README §25)

| # | Capability | State |
|---|-----------|-------|
| 1-2 | Download / install without cloud | 🟡 from source only (`pnpm start`); no installer |
| 3-4 | Launch without account, local profile | ✅ |
| 5-7 | Campus, explore, enter buildings | ✅ (interiors are 2D panels, not 3D interior scenes) |
| 8 | Offline content | ✅ no network calls at runtime (CDN-loading drei helpers avoided) |
| 9 | Interactive simulations | ✅ 6 labs |
| 10-12 | Exercises, safe submission, verifiable feedback | ✅ (sandbox strength varies by OS - reported to the student) |
| 13 | Competency tracking | ✅ |
| 14 | Save projects | ✅ personal lab + mission workspaces |
| 15-16 | Export / import on another laptop | ✅ tested as a fresh install in `test_backup.py` |
| 17 | Restart without losing progress | ✅ tested + verified in browser |
| 18 | Works without any AI model | ✅ |

### Tests executed (actual results)

* `backend`: **87 passed** (pytest, ~12 s), `ruff check` clean
* `packages/world-engine`: **11 passed** (Vitest)
* `apps/web`: **5 passed** (Vitest + Testing Library), `tsc` clean, production build OK
* Browser walkthrough on the production build - see TESTING.md. It found and fixed four real bugs: welcome layout overflow, movement slowing down at low FPS (now sub-stepped), lax divergence detection in the GD lab, and a crash from Chromium's Promise-returning `scrollIntoView` used as an effect cleanup (an error boundary now also isolates panel failures).

### Known defects / gaps

1. No 3D building interiors; building entry opens 2D panels.
2. Avatar and buildings are procedural primitives; no GLB/Blender asset pipeline yet (the scene would need a `useGLTF` loader + LOD once assets exist).
3. Frame rate not measured on the 8 GB / integrated-GPU baseline.
4. Windows sandbox has no OS isolation; Linux bubblewrap path untested. `RLIMIT_AS` not available on macOS.
5. Mission quality score gives partial credit even when nothing is implemented (it cannot pass - correctness gates it - but the score is not 0).
6. Mentor not tested against a running Ollama model (adapter covered with a fake provider).
7. No Playwright E2E in CI; CI workflow written but never run (no remote).
8. Accessibility: keyboard play works, but there is no non-3D navigation mode and screen-reader labels on radio options are partial.
9. Tauri desktop app, installers, signed releases: not started.

## Next milestones (in order)

1. **Commit + push** the slice; run CI on macOS/Linux/Windows and fix platform issues (Windows paths, sandbox).
2. **Playwright E2E**: profile → campus → lesson → assessment → mission → backup round trip, against `pnpm start`.
3. **Performance pass**: measure FPS on integrated graphics; add auto-downgrade suggestion when FPS < 25.
4. **Phase 10 desktop**: install Rust, scaffold Tauri 2 in `apps/desktop`, sidecar the backend (PyInstaller), random port + token handshake.
5. **Windows sandbox**: Job Objects (CPU/memory/process limits) + restricted token / AppContainer.
6. **Content expansion**: District 04 Generative AI (tokenisation, embeddings, RAG concept + optional embedding retrieval via Ollama embeddings).
7. 3D interiors for the three active buildings; GLB asset pipeline with licence tracking.

## Continuation handoff (for the next session)

* **Run**: `npx pnpm@9.15.9 install && (cd backend && uv sync) && pnpm start`. Tests: `pnpm test`.
* **Key decisions** (do not relitigate without reason):
  * All business logic lives in the Python backend; frontend is presentation + pure world engine. No TS copies of engines.
  * Content is data in `content/`, validated by `load_catalog`; catalog mirrored into SQLite only when the hash or `SYNC_FORMAT` changes.
  * Concept/mission IDs are slugs; student records use UUIDs; `progress.concept_id` is deliberately not a FK.
  * Token auth: backend injects `<meta name="nexora-token">` into served HTML; dev proxy injects the header. Host header validated.
  * Sandbox: `workers/sandbox.py` + `workers/harness.py`, nonce-tagged JSON result read from stdin before student import.
  * Mastery rules in `docs/LEARNING_MODEL.md` are tested - change both together.
  * Movement uses sub-stepping (`MAX_SUBSTEP` 0.05 s, `MAX_FRAME` 0.25 s).
* **Gotchas**: `npx pnpm@9.15.9` (Corepack's pnpm cache was broken on the dev machine); Chromium's `scrollIntoView` returns a Promise - never use expression-bodied effects for it; drei `<Environment>`/`<Text>` fetch from CDNs - avoid; the desktop app's preview launcher could not read `~/Desktop` (macOS privacy), so start servers from a shell.
