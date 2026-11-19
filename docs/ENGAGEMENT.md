# Engagement systems

Every engagement mechanic is backed by verified learning activity. Nothing here can change a scientific result.

## Failure spectacle engine

```
Simulation engine → result → event classifier (backend/nexora/modules/simulations/events.py)
                  → SimEvent[] in the API response → event bus (apps/web/src/engine/simEvents.ts)
                  → Experiment Machine, lab banners, onboarding network, camera shake
```

| Event | Emitted when (thresholds in `events.py`) | Severity |
|-------|------------------------------------------|----------|
| LOSS_DIVERGENCE | GD status `diverged`; NN peak loss > 3× initial or final > 2× initial | critical |
| GRADIENT_EXPLOSION | GD gradient norm > 1000; NN layer gradient norm > 50 | critical |
| NAN_DETECTED | NN weights/outputs non-finite | critical |
| OVERFITTING_DETECTED | NN train−test accuracy > 0.12; ML > 0.08 | warning |
| UNDERFITTING_DETECTED | NN train acc < 0.75; ML test acc < 0.8 | warning |
| OSCILLATION | GD direction reversals without divergence | warning |
| TRAINING_STALLED | GD budget exhausted; NN loss moved < 1% | warning |
| RETRIEVAL_FAILURE | RAG recall@k < 0.5 or no results | critical |
| MEMORY_OVERFLOW | Infrastructure estimate exceeds device memory (labelled *estimate*) | critical |
| SUCCESSFUL_CONVERGENCE | GD converged; NN train ≥ 0.9 and gap ≤ 0.12; ML test ≥ 0.9; RAG MRR ≥ 0.7; infra fits | success |

`NUMERICAL_INSTABILITY` is defined but not yet emitted. The machine shows the most severe event of the latest run. Reduced motion (setting or OS preference) disables shake, sparks and jitter; status is always shown as text and icon as well as colour.

## Break challenges

`content/challenges/challenges.json` defines 15 challenges (1 onboarding + 14 across five labs). Each has `initial_config`, `allowed` keys (everything else is fixed server-side), declarative `target` conditions (`metric`, `config`, `event`, `no_event`), `hints`, `explanation` (revealed only after a pass) and `xp`. `backend/tests/test_engagement.py` proves every challenge **fails at its initial config and passes with a known solution**.

## XP, levels, ranks, streaks

`content/progression/progression.json` (versioned). XP is written only through `progression.award`, keyed by a unique `award_key` per student, so the same accomplishment never pays twice:

| Source | XP | Key |
|--------|----|-----|
| Passing an assessment (first time) | 40 | `assessment:<concept>` |
| Mastering a concept | 60 | `mastery:<concept>` |
| Passing a mission | 100 / 150 / 200 by difficulty | `mission:<id>` |
| Solving a break challenge | 25-80 | `challenge:<id>` |
| Debug of the Day | 40 | `daily:<number>` |
| Saving a valid experiment | 5, max 3 per day | `experiment:<date>:<n>` |

Opening lessons, failing, and repeating solved work earn nothing. Ranks (Intern → Junior → Engineer → Senior → Principal → Research Scientist) require XP **and** evidence: mastered concepts, passed missions, solved challenges, Daily puzzles and skill levels. Research Scientist needs a research reproduction, which does not exist yet, so it is currently unreachable by design.

Streak days are local dates (student's IANA time zone) with an assessment attempt, a passed mission or challenge, or a saved experiment. If today has no activity yet, the streak counts from yesterday. Nothing is lost by taking a break except the counter.

## Debug of the Day

`content/daily/`: 7 puzzles, each `broken.py` + hidden `tests.py` + explanation; reference fixes live in `backend/tests/fixtures/daily_fixes/`. Puzzle number = days since 2026-01-01 + 1 in the student's local date; the API accepts only dates within ±1 day of server UTC. Local clocks can be changed - this is a personal practice calendar, not a trusted competition clock. The share grid row for each attempt is the real pass/fail of each hidden test.

## Share cards

`GET /students/{id}/share-card?kind=mission|challenge|daily|rank&ref=` returns claims read from stored records (409 if nothing is verified). The frontend draws a 1200×630 PNG on a canvas (`components/engagement/shareCard.ts`) with a preview, PNG download, clipboard copy and OS share where supported. Cards never contain email, paths, code, conversations or tokens; the display name only if the student ticks the box.

## Living campus

The plaza has an Experiment Machine and Professor Nova; Atlas, Newton and Neural stand by their buildings. Dialogue is deterministic and generated from verified records only (`professorLines`). Building window strips brighten with the district's mastered fraction; a hologram appears at 50% and a light beam at 100%.

## Onboarding

New profiles start with `settings.onboarding = "pending"`; the panel opens automatically, is skippable, and can be replayed from Settings. Start and completion timestamps are stored locally only (measured: 52 s in the v0.2 browser walkthrough).
