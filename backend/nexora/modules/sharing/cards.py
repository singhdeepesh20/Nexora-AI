"""Verified share-card data. Every claim is read from stored, verified records - never from the client.

Privacy: cards never contain email, file paths, code, conversations or tokens. The display name is
included only when the student explicitly asks for it.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from nexora.infrastructure.database.models import ChallengeAttempt, DailySession, Student, Submission


class NotVerified(LookupError):
    pass


def _attempts_until_pass(rows: list) -> tuple[int, Any]:
    for i, r in enumerate(rows, 1):
        if r.passed:
            return i, r
    raise NotVerified("No verified pass recorded")


def mission_card(session: Session, catalog, student_id: str, mission_id: str) -> dict[str, Any]:
    m = catalog.missions.get(mission_id)
    if m is None:
        raise NotVerified("Unknown mission")
    rows = session.scalars(select(Submission).where(Submission.student_id == student_id, Submission.mission_id == mission_id)
                           .order_by(Submission.created_at)).all()
    n, sub = _attempts_until_pass(rows)
    tests = sub.result.get("tests", [])
    passed = sum(t["status"] == "passed" for t in tests)
    stats = [{"label": "Attempts", "value": str(n)}, {"label": "Hidden tests passed", "value": f"{passed}/{len(tests)}"},
             {"label": "Score", "value": f"{sub.score:.0%}"}]
    grad = [t for t in tests if "gradient" in t["name"]]
    if grad:
        stats.append({"label": "Gradient verification", "value": "Passed" if all(t["status"] == "passed" for t in grad) else "Failed"})
    return {"layout": "mission", "eyebrow": "ENGINEERING MISSION COMPLETE", "title": m["title"].upper(),
            "headline": m["summary"], "stats": stats, "verified_at": sub.created_at.isoformat()}


