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


def _nn(cfg, r):
    out = []
    h = r["history"]
    if r["status"] == "diverged":
        return [_ev("NAN_DETECTED", "critical", "NaN detected", "Weights or outputs became non-finite. Training stopped.",
                    learning_rate=cfg["learning_rate"])]
    losses = h["train_loss"]
    if not losses:
        return out
    first, peak, last = losses[0], max(losses), losses[-1]
    if peak > DIVERGENCE_RATIO * first or last > 2 * first:
        out.append(_ev("LOSS_DIVERGENCE", "critical", "Loss divergence",
                       f"Training loss rose from {first:.3f} to a peak of {peak:.3f}. The optimiser is overshooting.",
                       initial_loss=first, peak_loss=peak, final_loss=last, learning_rate=cfg["learning_rate"]))
    gmax = max((max(g) for g in h["grad_norms"] if g), default=0.0)
    if gmax > 50:
        out.append(_ev("GRADIENT_EXPLOSION", "critical", "Gradient explosion", f"A layer's gradient norm reached {gmax:.3g}.",
                       max_gradient_norm=gmax, threshold=50))
    tr, te = r["final"]["train_acc"], r["final"]["test_acc"]
    diverging = any(e["type"] == "LOSS_DIVERGENCE" for e in out)
    if tr - te > OVERFIT_GAP:
        out.append(_ev("OVERFITTING_DETECTED", "warning", "Overfitting",
                       f"Train accuracy {tr:.0%} vs test {te:.0%}: the model memorised the training set.", gap=round(tr - te, 4)))
    if tr < UNDERFIT_ACC and not diverging:
        out.append(_ev("UNDERFITTING_DETECTED", "warning", "Underfitting",
                       f"Train accuracy is only {tr:.0%}: the model cannot capture the pattern.", train_acc=tr))
    if not diverging and len(losses) > 3 and abs(first - last) < 0.01 * first:
        out.append(_ev("TRAINING_STALLED", "warning", "Training stalled", "The loss barely moved.", initial_loss=first, final_loss=last))
    if not diverging and tr >= 0.9 and tr - te <= OVERFIT_GAP:
        out.append(_ev("SUCCESSFUL_CONVERGENCE", "success", "Successful convergence",
                       f"Loss fell from {first:.3f} to {last:.3f}; train {tr:.0%}, test {te:.0%}.", train_acc=tr, test_acc=te))
    return out


def _ml(cfg, r):
    out = []
    tr, te = r["train_accuracy"], r["test_accuracy"]
    if tr - te > 0.08:
        out.append(_ev("OVERFITTING_DETECTED", "warning", "Overfitting", f"Train {tr:.0%} vs test {te:.0%}.", gap=round(tr - te, 4)))
    if te < 0.8:
        out.append(_ev("UNDERFITTING_DETECTED", "warning", "Poor generalisation", f"Test accuracy is {te:.0%}.", test_accuracy=te))
    if not out and te >= 0.9:
        out.append(_ev("SUCCESSFUL_CONVERGENCE", "success", "Strong model", f"Test accuracy {te:.0%}, macro F1 {r['macro_f1']:.3f}.",
                       test_accuracy=te, macro_f1=r["macro_f1"]))
    return out


def _rag(cfg, r):
    ev = r.get("evaluation")
    if not r["results"] or (ev and ev["recall_at_k"] < 0.5):
        return [_ev("RETRIEVAL_FAILURE", "critical", "Retrieval failure",
                    "The retriever misses most relevant passages." if ev else "No passage matched the query.",
                    recall_at_k=ev["recall_at_k"] if ev else 0.0, mrr=ev["mrr"] if ev else 0.0)]
    if ev and ev["mrr"] >= 0.7:
        return [_ev("SUCCESSFUL_CONVERGENCE", "success", "Precise retrieval", f"MRR {ev['mrr']:.2f}, recall@{ev['k']} {ev['recall_at_k']:.2f}.",
                    mrr=ev["mrr"], recall_at_k=ev["recall_at_k"])]
    return []


def _infra(cfg, r):
    e = r["estimate"]
    if not e["fits"]:
        return [_ev("MEMORY_OVERFLOW", "critical", "GPU memory overflow (estimate)",
                    f"Needs ~{e['memory_gb']['total']} GB but the device has {e['memory_gb']['device_capacity']} GB.",
                    required_gb=e["memory_gb"]["total"], capacity_gb=e["memory_gb"]["device_capacity"], estimate=True)]
    return [_ev("SUCCESSFUL_CONVERGENCE", "success", "Deployment fits (estimate)",
                f"~{e['memory_gb']['total']} GB of {e['memory_gb']['device_capacity']} GB used.", estimate=True)]
