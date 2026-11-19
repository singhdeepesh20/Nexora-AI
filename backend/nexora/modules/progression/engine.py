"""Competency-driven progression: XP ledger, levels, engineer ranks and learning streaks.

* XP is only written through `award`, keyed by a unique `award_key` per student, so the same verified
  accomplishment can never pay out twice (anti-farming). Experiments are capped per day.
* Ranks are computed from verified evidence (mastery, missions, challenges, skills, daily puzzles),
  never from XP alone, and never stored - the competency engine stays the source of truth.
* Streaks are computed from meaningful activity in the student's local time zone. Breaks are never
  penalised beyond the streak counter itself.
"""

from __future__ import annotations

import json
from datetime import UTC, date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from nexora.core.ids import utcnow
from nexora.infrastructure.database.models import (
    AssessmentAttempt,
    ChallengeAttempt,
    DailySession,
    Experiment,
    Submission,
    XPTransaction,
)


def load_rules(content_dir: Path) -> dict[str, Any]:
    return json.loads((content_dir / "progression" / "progression.json").read_text(encoding="utf-8"))


def award(session: Session, rules: dict, student_id: str, award_key: str, source_type: str, source_id: str,
          xp: int, reason: str) -> dict | None:
    """Insert one XP transaction unless this award_key was already paid. Returns the award or None."""
    if xp <= 0:
        return None
    if session.scalar(select(XPTransaction.id).where(XPTransaction.student_id == student_id,
                                                     XPTransaction.award_key == award_key)):
        return None
    try:
        with session.begin_nested():
            session.add(XPTransaction(student_id=student_id, award_key=award_key, source_type=source_type,
                                      source_id=source_id, xp=xp, reason=reason, rule_version=rules["version"]))
    except IntegrityError:  # concurrent duplicate - the unique constraint wins
        return None
    return {"xp": xp, "reason": reason}


def award_experiment(session: Session, rules: dict, student_id: str, experiment_id: str, sim_id: str) -> dict | None:
    today = utcnow().date().isoformat()
    cap = rules["xp"]["experiment_daily_cap"]
    used = session.scalar(select(func.count()).select_from(XPTransaction).where(
        XPTransaction.student_id == student_id, XPTransaction.award_key.like(f"experiment:{today}:%"))) or 0
    if used >= cap:
        return None
    return award(session, rules, student_id, f"experiment:{today}:{used + 1}", "experiment", experiment_id,
                 rules["xp"]["experiment"], f"Valid experiment in the {sim_id.replace('_', ' ')} lab")


def level_for(xp: int, rules: dict) -> dict[str, Any]:
    base, growth = rules["levels"]["base"], rules["levels"]["growth"]
    level, floor, need = 1, 0, base
    while xp >= floor + need:
        floor += need
        level += 1
        need = round(need * growth)
    return {"level": level, "level_floor": floor, "next_level_at": floor + need, "into_level": xp - floor, "level_span": need}


def evidence(session: Session, student_id: str, states: dict, skills: list[dict]) -> dict[str, Any]:
    missions = session.scalar(select(func.count(func.distinct(Submission.mission_id))).where(
        Submission.student_id == student_id, Submission.passed.is_(True))) or 0
    challenges = session.scalar(select(func.count(func.distinct(ChallengeAttempt.challenge_id))).where(
        ChallengeAttempt.student_id == student_id, ChallengeAttempt.kind == "break", ChallengeAttempt.passed.is_(True))) or 0
    daily = session.scalar(select(func.count()).select_from(DailySession).where(
        DailySession.student_id == student_id, DailySession.solved_at.is_not(None))) or 0
    xp = session.scalar(select(func.coalesce(func.sum(XPTransaction.xp), 0)).where(XPTransaction.student_id == student_id)) or 0
    return {"xp": int(xp), "mastered_concepts": sum(s["status"] == "mastered" for s in states.values()),
            "missions_passed": int(missions), "challenges_passed": int(challenges), "daily_solved": int(daily),
            "research_reproductions": 0, "skills": {s["skill_id"]: s["level"] for s in skills}}


def _check(req: dict, ev: dict) -> list[dict]:
    checks = []
    labels = {"xp": "XP", "mastered_concepts": "Concepts mastered", "missions_passed": "Missions passed",
              "challenges_passed": "Break challenges solved", "daily_solved": "Daily Debug puzzles solved",
              "research_reproductions": "Research reproductions (research environment not yet available)"}
    for key, need in req.items():
        if key == "skills":
            for sid, lvl in need.items():
                have = ev["skills"].get(sid, 0.0)
                checks.append({"label": f"Skill {sid.replace('_', ' ')} at {lvl:.0%}", "have": round(have, 3), "need": lvl,
                               "met": have >= lvl, "unit": "percent"})
        else:
            checks.append({"label": labels[key], "have": ev[key], "need": need, "met": ev[key] >= need, "unit": "count"})
    return checks


def rank(rules: dict, ev: dict) -> dict[str, Any]:
    current, nxt = rules["ranks"][0], None
    for r in rules["ranks"]:
        if all(c["met"] for c in _check(r["requirements"], ev)):
            current = r
        else:
            nxt = r
            break
    idx = rules["ranks"].index(current)
    return {"id": current["id"], "title": current["title"], "index": idx, "of": len(rules["ranks"]),
            "next": None if nxt is None else {"id": nxt["id"], "title": nxt["title"], "checks": _check(nxt["requirements"], ev)}}


def parse_tz(tz: str | None) -> ZoneInfo | timezone:
    if not tz:
        return UTC
    try:
        return ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError):
        return UTC


def activity_days(session: Session, student_id: str, tz) -> set[date]:
    """Local dates with a meaningful learning action: an assessment attempt, a passed mission, a passed
    challenge or solved daily puzzle, or a saved valid experiment."""
    stamps: list[datetime] = []
    stamps += session.scalars(select(AssessmentAttempt.created_at).where(AssessmentAttempt.student_id == student_id)).all()
    stamps += session.scalars(select(Submission.created_at).where(Submission.student_id == student_id,
                                                                  Submission.passed.is_(True))).all()
    stamps += session.scalars(select(ChallengeAttempt.created_at).where(ChallengeAttempt.student_id == student_id,
                                                                        ChallengeAttempt.passed.is_(True))).all()
    stamps += session.scalars(select(Experiment.created_at).where(Experiment.student_id == student_id)).all()
    return {s.replace(tzinfo=UTC).astimezone(tz).date() for s in stamps}


def streaks(days: set[date], today: date) -> dict[str, Any]:
    longest = run = 0
    prev = None
    for d in sorted(days):
        run = run + 1 if prev and d - prev == timedelta(days=1) else 1
        longest = max(longest, run)
        prev = d
    # Current streak counts back from today, or from yesterday if today has no activity yet (no penalty mid-day).
    anchor = today if today in days else today - timedelta(days=1)
    current = 0
    while anchor in days:
        current += 1
        anchor -= timedelta(days=1)
    calendar = [{"date": (today - timedelta(days=i)).isoformat(), "active": (today - timedelta(days=i)) in days}
                for i in range(83, -1, -1)]
    return {"current": current, "longest": longest, "active_today": today in days, "calendar": calendar,
            "total_active_days": len(days)}


def summary(session: Session, rules: dict, student_id: str, states: dict, skills: list[dict], tz_name: str | None,
            now: datetime | None = None) -> dict[str, Any]:
    tz = parse_tz(tz_name)
    now = now or utcnow()
    today = now.replace(tzinfo=UTC).astimezone(tz).date()
    ev = evidence(session, student_id, states, skills)
    history = session.scalars(select(XPTransaction).where(XPTransaction.student_id == student_id)
                              .order_by(XPTransaction.created_at.desc()).limit(50)).all()
    return {"xp": ev["xp"], "level": level_for(ev["xp"], rules), "rank": rank(rules, ev), "evidence": ev,
            "streak": streaks(activity_days(session, student_id, tz), today), "timezone": str(tz),
            "rule_version": rules["version"],
            "history": [{"xp": h.xp, "reason": h.reason, "source_type": h.source_type, "created_at": h.created_at.isoformat()}
                        for h in history]}
