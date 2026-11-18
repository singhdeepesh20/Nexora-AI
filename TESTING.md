# Testing

```bash
pnpm test              # world-engine + web (Vitest) and backend (pytest)
pnpm test:backend      # backend only
pnpm typecheck
pnpm lint:backend      # ruff
```

## What is covered

| Suite | File(s) | Highlights |
|-------|---------|-----------|
| Content integrity | `backend/tests/test_catalog.py` | schema, acyclic prerequisites, unknown references, answer-key validity |
| Security | `test_security.py` | token, DNS-rebinding host check, no CORS, loopback-only Ollama, workspace traversal, cross-student isolation |
| Profiles & persistence | `test_students.py` | lifecycle, cascade delete incl. files, restart persistence |
| Learning engine | `test_learning.py` | prerequisite enforcement, lesson-opening ≠ mastery, required missions, mastery formula, reproducible grading, review scheduling, skills |
| Simulations | `test_simulations.py` | hand-computed GD step, stability limit & divergence, oscillation at the limit, backprop vs finite differences, XOR, failure diagnostics, metric consistency, BM25 evaluation, attention row sums and permutation equivariance, infra arithmetic, reproducible experiments |
| Sandbox | `test_sandbox.py` | timeout, network/subprocess/write blocking, stdout-spoofing resistance, file-name validation, macOS OS-layer test without Python guards |
| Missions | `test_missions.py` | every reference solution passes, every starter fails, partial credit, timeouts, syntax errors, quality checks, API prerequisite gating |
| Mentors | `test_mentors.py` | offline answers grounded in lessons, Socratic rotation, coding diagnostics, model fallback, grounding passed to local models |
| Backup | `test_backup.py` | round trip onto a fresh install ("another laptop"), restore after delete-all, tamper/path-traversal/newer-schema/garbage rejection |
| World engine | `packages/world-engine/src/index.test.ts` | camera-relative movement, speeds, sub-stepping at 5 FPS, wall collision and sliding, bounds, interaction ranges, deterministic scenery |
| Web | `apps/web/src/__tests__/app.test.tsx` | token header, overlay navigation, Markdown sanitisation, profile creation, assessment feedback |

## Manual / browser verification performed for v0.1.0

Against a production build served by the backend: profile creation → spawn on campus → walking with collision (monument and building walls) → position persisted and restored after reload → "Press E" prompt at Foundation Hall → district panel → lesson → assessment passed (unlocks next concept, achievement toast) → Esc back-stack and pause menu → Monaco mission editor loads offline and evaluates code in the sandbox → Gradient Descent lab "Break it" preset → offline mentor coding diagnosis.

## Not yet automated

Playwright end-to-end tests, WebGL scene tests in CI, frame-rate benchmarks on baseline hardware, Windows/Linux runs of the sandbox, desktop startup/shutdown. Tracked in IMPLEMENTATION_STATUS.md.
