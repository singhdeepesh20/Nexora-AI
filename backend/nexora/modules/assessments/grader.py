"""Deterministic assessment grading. Same answers + same assessment version => same result."""

from __future__ import annotations

import math
from typing import Any


def public_view(assessment: dict[str, Any]) -> dict[str, Any]:
    """Assessment without answer keys or explanations."""
    qs = []
    for q in assessment["questions"]:
        item = {"id": q["id"], "type": q["type"], "prompt": q["prompt"]}
        if q["type"] == "choice":
            item["options"] = q["options"]
        qs.append(item)
    return {"concept_id": assessment["concept_id"], "version": assessment["version"],
            "pass_score": assessment["pass_score"], "questions": qs}


def _correct(q: dict[str, Any], answer: Any) -> bool:
    if answer is None:
        return False
    try:
        if q["type"] == "choice":
            return int(answer) == int(q["answer"])
        value = float(str(answer).strip())
        return math.isfinite(value) and abs(value - float(q["answer"])) <= float(q["tolerance"]) + 1e-12
    except (TypeError, ValueError):
        return False


def grade(assessment: dict[str, Any], answers: dict[str, Any]) -> dict[str, Any]:
    results = []
    for q in assessment["questions"]:
        given = answers.get(q["id"])
        ok = _correct(q, given)
        results.append({
            "id": q["id"], "correct": ok, "given": given,
            "expected": q["options"][q["answer"]] if q["type"] == "choice" else q["answer"],
            "explanation": q["explanation"],
        })
    score = sum(r["correct"] for r in results) / len(results)
    return {"score": round(score, 4), "passed": score >= assessment["pass_score"] - 1e-9,
            "pass_score": assessment["pass_score"], "results": results}
