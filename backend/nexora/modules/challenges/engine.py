"""Break Challenges: declarative targets evaluated against real simulation output.

A target condition is one of:
  {"metric": name, "op": op, "value": v}   - a metric extracted from the result
  {"config": key,  "op": op, "value": v}   - a constraint on the configuration actually used
  {"event": TYPE} / {"no_event": TYPE}     - presence/absence of a classified event
The student may only change `allowed` keys; everything else is fixed to `initial_config` server-side.
"""

from __future__ import annotations

import json
import operator
from pathlib import Path
from typing import Any

from nexora.modules.simulations.events import classify
from nexora.modules.simulations.registry import SIMULATIONS, run_simulation, summarize

OPS = {">=": operator.ge, ">": operator.gt, "<=": operator.le, "<": operator.lt, "==": operator.eq, "!=": operator.ne}


class ChallengeError(ValueError):
    pass


def load_challenges(content_dir: Path) -> dict[str, dict[str, Any]]:
    data = json.loads((content_dir / "challenges" / "challenges.json").read_text(encoding="utf-8"))
    out = {}
    for c in data["challenges"]:
        if c["lab"] not in SIMULATIONS:
            raise ChallengeError(f"Challenge {c['id']} uses unknown lab {c['lab']}")
        SIMULATIONS[c["lab"]].config_model.model_validate(c["initial_config"])  # must be runnable as-is
        for cond in c["target"]:
            if "op" in cond and cond["op"] not in OPS:
                raise ChallengeError(f"Challenge {c['id']} has unknown operator {cond['op']}")
        out[c["id"]] = c
    return out


def metrics(sim_id: str, config: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    if sim_id == "gradient_descent":
        return {"status": result["status"], "iterations": result["iterations_run"], "final_loss": result["final"]["loss"],
                "direction_reversals": result["analysis"]["direction_reversals_recent"],
                "stability_limit": result["analysis"]["stability_limit_lr"]}
    if sim_id == "neural_network":
        return {**result["final"], "status": result["status"]}
    if sim_id == "ml_lab":
        return {k: result[k] for k in ("train_accuracy", "test_accuracy", "macro_f1")}
    if sim_id == "rag":
        ev = result["evaluation"] or {}
        top = result["results"][0]["doc_id"] if result["results"] else None
        return {"mrr": ev.get("mrr", 0.0), "recall_at_k": ev.get("recall_at_k", 0.0), "n_chunks": result["n_chunks"], "top_doc": top}
    if sim_id == "infrastructure":
        e = result["estimate"]
        return {"fits": e["fits"], "total_gb": e["memory_gb"]["total"], "tokens_per_s": e["throughput_tokens_per_s"]}
    return {}


def build_config(challenge: dict[str, Any], student_config: dict[str, Any]) -> dict[str, Any]:
    illegal = sorted(set(student_config) - set(challenge["allowed"]))
    if illegal:
        raise ChallengeError(f"These settings are fixed in this challenge: {', '.join(illegal)}")
    return {**challenge["initial_config"], **student_config}


def evaluate(challenge: dict[str, Any], config: dict[str, Any], result: dict[str, Any], events: list[dict]) -> dict[str, Any]:
    m = metrics(challenge["lab"], config, result)
    types = {e["type"] for e in events}
    checks = []
    for cond in challenge["target"]:
        if "event" in cond:
            ok, actual = cond["event"] in types, sorted(types)
        elif "no_event" in cond:
            ok, actual = cond["no_event"] not in types, sorted(types)
        elif "metric" in cond:
            actual = m.get(cond["metric"])
            ok = actual is not None and bool(OPS[cond["op"]](actual, cond["value"]))
        else:
            actual = config.get(cond["config"])
            ok = actual is not None and bool(OPS[cond["op"]](actual, cond["value"]))
        checks.append({"label": cond["label"], "passed": ok, "actual": actual})
    return {"passed": all(c["passed"] for c in checks), "checks": checks, "metrics": m}


def attempt(challenge: dict[str, Any], student_config: dict[str, Any], ctx: Any = None) -> dict[str, Any]:
    cfg_in = build_config(challenge, student_config)
    config, result = run_simulation(challenge["lab"], cfg_in, ctx)
    events = classify(challenge["lab"], config, result)
    ev = evaluate(challenge, config, result, events)
    return {"config": config, "result": result, "events": events, "summary": summarize(challenge["lab"], result), **ev}


def public_view(c: dict[str, Any]) -> dict[str, Any]:
    keep = ("id", "version", "lab", "difficulty", "title", "description", "objective", "initial_config", "allowed", "xp",
            "achievement")
    return {k: c.get(k) for k in keep} | {"onboarding": bool(c.get("onboarding")),
                                         "target": [t["label"] for t in c["target"]], "hint_count": len(c["hints"])}
