"""Debug of the Day: deterministic local puzzle calendar, hidden-test evaluation, honest share grid.

Puzzle number = (local date - epoch).days + 1; puzzle = order[(number - 1) % len(order)].
The same date and calendar version always give the same puzzle. Local clocks can be changed, so this
is a personal practice calendar, not a trusted global competition clock.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

from nexora.workers.sandbox import Limits, run_python


def load_daily(content_dir: Path) -> dict[str, Any]:
    root = content_dir / "daily"
    cal = json.loads((root / "calendar.json").read_text(encoding="utf-8"))
    puzzles = {}
    for pid in cal["order"]:
        meta = json.loads((root / pid / "puzzle.json").read_text(encoding="utf-8"))
        meta["broken"] = (root / pid / "broken.py").read_text(encoding="utf-8")
        meta["tests"] = (root / pid / "tests.py").read_text(encoding="utf-8")
        puzzles[pid] = meta
    return {"calendar": cal, "puzzles": puzzles}


def puzzle_for(day: date, daily: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    cal = daily["calendar"]
    number = (day - date.fromisoformat(cal["epoch"])).days + 1
    if number < 1:
        raise ValueError("date is before the puzzle calendar starts")
    pid = cal["order"][(number - 1) % len(cal["order"])]
    return number, daily["puzzles"][pid]


def test_count(puzzle: dict[str, Any]) -> int:
    import ast
    return sum(isinstance(n, ast.FunctionDef) and n.name.startswith("test_") for n in ast.parse(puzzle["tests"]).body)


def evaluate(puzzle: dict[str, Any], code: str) -> dict[str, Any]:
    run = run_python({"solution.py": code, "tests.py": puzzle["tests"]}, "tests",
                     Limits(timeout_s=float(puzzle.get("time_limit_s", 15)), cpu_s=int(puzzle.get("time_limit_s", 15))))
    if run.timed_out:
        problem = "Time limit exceeded."
    elif run.payload is None:
        problem = "The test process crashed."
    elif run.payload.get("import_error"):
        problem = "Your code could not be imported:\n" + run.payload["import_error"]
    else:
        problem = None
    tests = [] if problem else run.payload["tests"]
    outcomes = [t["status"] == "passed" for t in tests] if tests else [False] * test_count(puzzle)
    return {"passed": bool(tests) and all(outcomes), "outcomes": outcomes, "problem": problem,
            "failures": [{"message": t["message"]} for t in tests if t["status"] != "passed"][:3],
            "isolation": run.isolation}


def share_text(number: int, rows: list[list[bool]], solved: bool, seconds: int | None) -> str:
    grid = "\n".join(" ".join("🟩" if ok else "🟥" for ok in row) for row in rows)
    time = f"{seconds // 60:02d}:{seconds % 60:02d}" if seconds is not None else "--:--"
    return (f"NEXORA DEBUG OF THE DAY\nPuzzle #{number:03d}\n\nResult: {'Solved' if solved else 'Not solved yet'}\n"
            f"Attempts: {len(rows)}\nTime: {time}\n\n{grid}\n\nLEARN AI BY ENGINEERING AI.")
