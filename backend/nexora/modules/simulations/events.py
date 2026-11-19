"""Event classifier: Simulation result -> typed scientific events.

The classifier only *reads* deterministic simulation output. Visual effects in the frontend react to
these events; they never influence the science. Thresholds are documented here and unit-tested.
"""

from __future__ import annotations

from typing import Any

SEVERITY = ("info", "success", "warning", "critical")
EVENT_TYPES = {
    "LOSS_DIVERGENCE", "GRADIENT_EXPLOSION", "OVERFITTING_DETECTED", "UNDERFITTING_DETECTED", "NUMERICAL_INSTABILITY",
    "MEMORY_OVERFLOW", "NAN_DETECTED", "TRAINING_STALLED", "RETRIEVAL_FAILURE", "OSCILLATION", "SUCCESSFUL_CONVERGENCE",
}

DIVERGENCE_RATIO = 3.0      # NN: peak loss > 3x initial loss, or final > 2x initial
GRADIENT_EXPLOSION_NORM = 1e3
OVERFIT_GAP = 0.12
UNDERFIT_ACC = 0.75


def _ev(type_: str, severity: str, title: str, message: str, **metrics: Any) -> dict[str, Any]:
    assert type_ in EVENT_TYPES and severity in SEVERITY
    return {"type": type_, "severity": severity, "title": title, "message": message, "metrics": metrics}


def classify(sim_id: str, config: dict[str, Any], result: dict[str, Any]) -> list[dict[str, Any]]:
    fn = {"gradient_descent": _gd, "neural_network": _nn, "ml_lab": _ml, "rag": _rag, "infrastructure": _infra}.get(sim_id)
    return fn(config, result) if fn else []


def _gd(cfg, r):
    out = []
    a = r["analysis"]
    gmax = max((g for g in r["grad_norm"] if g is not None), default=0.0)
    if r["status"] == "diverged":
        out.append(_ev("LOSS_DIVERGENCE", "critical", "Loss divergence",
                       "The loss exploded: each update overshoots the minimum further than the last.",
                       learning_rate=cfg["learning_rate"], stability_limit=a["stability_limit_lr"], iterations=r["iterations_run"]))
    if gmax > GRADIENT_EXPLOSION_NORM:
        out.append(_ev("GRADIENT_EXPLOSION", "critical", "Gradient explosion",
                       f"Gradient norm reached {gmax:.3g}, above the {GRADIENT_EXPLOSION_NORM:g} threshold.",
                       max_gradient_norm=gmax, threshold=GRADIENT_EXPLOSION_NORM))
    if r["status"] != "diverged" and a["direction_reversals_recent"] > 0 and r["iterations_run"] > 2:
        out.append(_ev("OSCILLATION", "warning", "Oscillation", "Successive steps reverse direction around the minimum.",
                       reversals=a["direction_reversals_recent"]))
    if r["status"] == "converged":
        out.append(_ev("SUCCESSFUL_CONVERGENCE", "success", "Converged",
                       f"Gradient norm fell below tolerance in {r['iterations_run']} iterations.", iterations=r["iterations_run"]))
    elif r["status"] == "max_iterations" and not any(e["type"] == "OSCILLATION" for e in out):
        out.append(_ev("TRAINING_STALLED", "warning", "Not converged yet",
                       "The iteration budget ran out before convergence - the learning rate may be too small.",
                       final_loss=r["final"]["loss"]))
    return out


