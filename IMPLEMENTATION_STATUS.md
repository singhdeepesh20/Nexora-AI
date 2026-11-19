# NEXORA - Implementation status

_Last updated: 2026-11-19 · version 0.4.0 (viral loop) · v0.2 pushed to GitHub; v0.3 and v0.4 not yet committed_

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

## Milestone report - viral loop (v0.4)

See docs/VIRAL.md. Play page, in-browser simulation, 7 proven daily puzzles, share grid/card/clip, friend links, break-it-first onboarding, chunk split (play page ~225 KB). **Not published** - needs the owner to enable GitHub Pages and run the manual workflow. No metrics are collected (by design); measuring virality needs an opt-in counter decided by the owner.

## Milestone report - NEXORA University arrival (v0.3)

| Phase (campus brief) | Status | Evidence |
|-------|--------|----------|
| Audit | ✅ | docs/CAMPUS.md |
| 1 University arrival | ✅ | Gate, guard, admission, ID card, verified gate opening; browser walkthrough: no ID → admission → card NXU-2026-00001 → guard verifies → walked in to z≈47. Barrier blocking proven in `campus.test.ts` |
| 2 Central campus | 🟡 partial | 30 classmates (walkers, groups, benches), conversations + local friendships, human faculty, fountain, day/night. Visual check of the crowd pending (browser pane was hidden, which pauses rendering) |
| 3 Academic buildings (lectures) | ⏳ | |
| 4 Student life (hostels, library, cafeteria, sports, clubs) | ⏳ | Portal lists these as not yet available |
| 5-7 | ⏳ | |

**Tests:** backend 136 (7 new campus tests: adult roster, arrival flow, unique IDs, friendships from verified facts, honest portal, backups include campus tables), web 18 (5 new), world-engine 12. Migration `0003_campus` verified up/down.

**Decision needed:** realistic humans and architecture require licensed GLB assets (e.g. CC0 packs) or an artist; nothing was downloaded.

## Milestone report - engagement slice (v0.2)

| Milestone | Status | Evidence |
|-----------|--------|----------|
| 0 Audit | ✅ | Reused catalog, simulations, sandbox, competency engine; new tables via migration `0002_engagement` (FTS-safe) |
| 1 First three minutes | ✅ | Auto-opening, skippable onboarding with a real diverging network (η = 20) fixed by the student; achievement + card. Browser run: **52 s** |
| 2 Failure spectacle engine | ✅ | Backend event classifier + typed frontend bus; Experiment Machine (lamps, sparks, shake), lab banners, onboarding network. Reduced-motion setting |
| 3 Break challenges | ✅ (14 + onboarding) | Every challenge proven unsolved-at-start and solvable in tests. The prompt's "data leakage", "class imbalance", "misleading accuracy" and "embedding vs lexical" ideas are not built (bundled datasets are near-balanced; no embedding model) |
| 4 Share cards | ✅ | 5 layouts (mission, challenge, onboarding, daily, rank); research layout not built (no research feature). Valid 1200×630 PNG verified in browser |
| 5 XP, ranks, streaks | ✅ | Ledger with unique award keys, daily experiment cap, evidence-based ranks, tz-aware streaks + calendar. Reminders not built |
| 6 Debug of the Day | ✅ | 7 puzzles, deterministic calendar, hidden tests, timer, real share grid |
| 7 Living campus | 🟡 partial | 4 professors with deterministic progress-aware dialogue; mastery-reactive buildings. **Not built:** cosmetic inventory/equip, avatar rank badges, easter eggs, walking NPCs |
| 8 Boss missions | ⏳ not started | |
| 9 Desktop distribution | ⏳ blocked | Rust not installed on the build machine; no installers have been built or tested |
| 10 Full integration | 🟡 | All suites green; no FPS/memory measurements on baseline hardware yet |

**Tests:** backend 129 passed (42 new), world-engine 12, web 13, typecheck + ruff clean.

**Bugs found during browser verification and fixed:** Experiment Machine hidden behind the onboarding panel (moved); stale "walk to a door" toast; HUD labels wrapping; truncated share-card titles (now shrink to fit); rank requirements of 1 shown as "0% / 100%" (requirements now carry a unit). Earlier probing also caught three unfair challenge designs before they shipped (k-NN target, retrieval "break" that BM25 shrugged off, a challenge already solved by its start config).

**Known limitations:** NN challenge runs take ~1-3 s on CPU; mission/daily sandbox strength still varies by OS; share-card fonts depend on installed system fonts; Daily dates trust the local clock.

### Next milestones
1. Cosmetics inventory + avatar rank badge (Milestone 7 remainder) and two easter eggs.
2. Boss missions: incident briefing → evidence → hypothesis → deterministic root-cause scoring (start with the GPU-memory incident, which the infrastructure lab already models).
3. Desktop installers once Rust is available; clean-machine test.
4. Playwright E2E for onboarding → challenge → share-card flow.

## Next milestones from v0.1 (in order)

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
