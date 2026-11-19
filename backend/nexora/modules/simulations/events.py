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


