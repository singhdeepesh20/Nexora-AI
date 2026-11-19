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


def challenge_card(session: Session, challenges: dict, student_id: str, challenge_id: str) -> dict[str, Any]:
    c = challenges.get(challenge_id)
    if c is None:
        raise NotVerified("Unknown challenge")
    rows = session.scalars(select(ChallengeAttempt).where(ChallengeAttempt.student_id == student_id,
                                                          ChallengeAttempt.kind == "break",
                                                          ChallengeAttempt.challenge_id == challenge_id)
                           .order_by(ChallengeAttempt.created_at)).all()
    n, att = _attempts_until_pass(rows)
    onboarding = bool(c.get("onboarding"))
    stats = [{"label": "Attempts", "value": str(n)}]
    stats += [{"label": ch["label"], "value": "✓"} for ch in att.result.get("checks", [])][:3]
    if onboarding:
        stats.insert(1, {"label": "Learning rate", "value": f"{att.payload.get('learning_rate')}"})
    return {"layout": "onboarding" if onboarding else "challenge",
            "eyebrow": "FIRST EXPERIMENT COMPLETED" if onboarding else f"BREAK CHALLENGE · {c['lab'].replace('_', ' ').upper()}",
            "title": c["title"].upper(), "headline": c["objective"], "stats": stats, "verified_at": att.created_at.isoformat()}


def daily_card(session: Session, student_id: str, number: int) -> dict[str, Any]:
    ds = session.scalar(select(DailySession).where(DailySession.student_id == student_id, DailySession.puzzle_number == number))
    if ds is None or ds.solved_at is None:
        raise NotVerified("Puzzle not solved")
    rows = session.scalars(select(ChallengeAttempt).where(ChallengeAttempt.student_id == student_id,
                                                          ChallengeAttempt.kind == "daily",
                                                          ChallengeAttempt.challenge_id == f"daily-{number}")
                           .order_by(ChallengeAttempt.created_at)).all()
    grid = [r.result["outcomes"] for r in rows if r.created_at <= ds.solved_at]
    secs = int((ds.solved_at - ds.started_at).total_seconds())
    return {"layout": "daily", "eyebrow": "DEBUG OF THE DAY", "title": f"PUZZLE #{number:03d}", "headline": "Solved",
            "stats": [{"label": "Attempts", "value": str(len(grid))}, {"label": "Time", "value": f"{secs // 60:02d}:{secs % 60:02d}"}],
            "grid": grid, "verified_at": ds.solved_at.isoformat()}


def rank_card(progress: dict[str, Any]) -> dict[str, Any]:
    ev = progress["evidence"]
    return {"layout": "rank", "eyebrow": "ENGINEER RANK", "title": progress["rank"]["title"].upper(),
            "headline": f"Level {progress['level']['level']} · {progress['xp']} XP",
            "stats": [{"label": "Concepts mastered", "value": str(ev["mastered_concepts"])},
                      {"label": "Missions passed", "value": str(ev["missions_passed"])},
                      {"label": "Break challenges", "value": str(ev["challenges_passed"])},
                      {"label": "Daily puzzles", "value": str(ev["daily_solved"])}],
            "verified_at": None}


def finalize(card: dict[str, Any], session: Session, student_id: str, rank_title: str, include_name: bool) -> dict[str, Any]:
    card["rank"] = rank_title
    card["footer"] = "LEARN AI BY ENGINEERING AI."
    card["name"] = session.get(Student, student_id).display_name if include_name else None
    return card
