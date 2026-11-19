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

