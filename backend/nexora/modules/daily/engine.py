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


