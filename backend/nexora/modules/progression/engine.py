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


