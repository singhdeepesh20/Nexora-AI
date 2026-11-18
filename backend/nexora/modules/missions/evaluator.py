"""Mission evaluation: runs hidden tests against the submission in the sandbox and scores it.

Scoring is fully deterministic given the test outcomes:
  correctness  = passed test_correct_* / total
  reliability  = passed test_edge_*    / total
  performance  = passed test_perf_*    / total
  quality      = static analysis score
  score        = weighted sum (weights from mission.json)
  passed       = every correctness test passes AND score >= 0.7
"""

from __future__ import annotations

from typing import Any

from nexora.modules.curriculum.catalog import Catalog
from nexora.modules.missions.quality import analyze
from nexora.workers.sandbox import Limits, run_python

PASS_SCORE = 0.7
CATEGORY_PREFIX = {"correctness": "test_correct_", "reliability": "test_edge_", "performance": "test_perf_"}


def categorize(name: str) -> str:
    for cat, prefix in CATEGORY_PREFIX.items():
        if name.startswith(prefix):
            return cat
    return "correctness"


def evaluate(catalog: Catalog, mission_id: str, code: str, limits: Limits | None = None) -> dict[str, Any]:
    mission = catalog.missions[mission_id]
    limits = limits or Limits(timeout_s=float(mission.get("time_limit_s", 20)), cpu_s=int(mission.get("time_limit_s", 20)))
    quality = analyze(code)
    run = run_python({"solution.py": code, "tests.py": catalog.mission_tests(mission_id)}, "tests", limits)
    weights = mission["evaluation"]["weights"]

    tests: list[dict[str, Any]] = []
    problem: str | None = None
    if run.timed_out:
        problem = f"Time limit of {limits.timeout_s:.0f}s exceeded. Look for infinite loops or very slow code."
    elif run.payload is None:
        problem = "The test process crashed before reporting results (possibly a memory or CPU limit)."
    elif run.payload.get("import_error"):
        problem = "Your module could not be imported:\n" + run.payload["import_error"]
    else:
        tests = [dict(t, category=categorize(t["name"])) for t in run.payload["tests"]]

    categories: dict[str, dict[str, Any]] = {}
    for cat in CATEGORY_PREFIX:
        members = [t for t in tests if t["category"] == cat]
        passed = sum(t["status"] == "passed" for t in members)
        categories[cat] = {"passed": passed, "total": len(members), "score": passed / len(members) if members else 0.0}
    categories["quality"] = {"score": quality["score"], "checks": quality["checks"]}

    score = sum(weights[c] * categories[c]["score"] for c in weights)
    if problem:
        score = 0.0
    correctness_ok = categories["correctness"]["total"] > 0 and categories["correctness"]["passed"] == categories["correctness"]["total"]
    passed = bool(not problem and correctness_ok and score >= PASS_SCORE)

    return {
        "mission_id": mission_id,
        "passed": passed,
        "score": round(score, 4),
        "problem": problem,
        "categories": categories,
        "tests": tests,
        "stdout": run.stdout,
        "stderr": run.stderr[-4000:],
        "duration_ms": run.duration_ms,
        "isolation": run.isolation,
        "syntax_error": quality["syntax_error"],
        "rule": mission["evaluation"]["pass_rule"],
    }
