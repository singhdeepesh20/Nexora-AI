# Contributing to NEXORA

Thank you for helping build an open AI engineering university.

## Ways to contribute

* **Curriculum** - lessons, assessments, missions (no code required). See `content/` and [docs/LEARNING_MODEL.md](docs/LEARNING_MODEL.md).
* **Laboratories** - new simulations in `backend/nexora/modules/simulations` (pure functions + Pydantic config + tests).
* **World** - districts, buildings, performance work in `apps/web/src/components/world` and `packages/world-engine`.
* **Platform** - sandboxing, packaging, accessibility, translations.

## Ground rules

1. **No fake features.** Every control must do something real; every simulation must compute real outputs. If something is a toy or an estimate, label it in the UI.
2. **AI stays optional.** Nothing may require a model, an API key or the internet.
3. **Student data stays local.** No telemetry, no external calls with student data.
4. **Tests with every change.** `pnpm test` must pass. Content changes are validated by `backend/tests/test_catalog.py`; a new mission needs a reference solution in `backend/tests/fixtures/mission_solutions/` so its tests are proven passable.
5. **Licences.** Only add assets, datasets, fonts, sounds or models with licences compatible with MIT redistribution, and record them in `THIRD_PARTY_NOTICES.md`.

## Adding a concept

1. `content/concepts/<id>.json` (copy an existing one), `content/lessons/<id>.md`, `content/assessments/<id>.json`.
2. Add the id to its district - concepts are grouped by their `district` field automatically.
3. Check every number in the lesson and answer keys. Run `cd backend && uv run pytest tests/test_catalog.py`.

## Adding a mission

`content/missions/<id>/mission.json`, `starter.py`, `tests.py`. Test functions are named `test_correct_*` (correctness), `test_edge_*` (reliability) or `test_perf_*` (performance). Tests must be fair to every correct implementation (e.g. do not depend on one lucky random seed). Add the reference solution fixture.

## Development setup

See [DEVELOPMENT.md](DEVELOPMENT.md). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).
