"""Deterministic achievements. Each is earned at most once per student."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from nexora.infrastructure.database.models import (
    Achievement,
    AssessmentAttempt,
    Conversation,
    Experiment,
    Submission,
)
from nexora.modules.curriculum.catalog import Catalog

DEFINITIONS = {
    "first_steps": "First Steps - created a NEXORA profile",
    "first_assessment": "Proven Understanding - passed a first assessment",
    "first_mission": "Engineer - passed a first engineering mission",
    "experimenter": "Experimenter - saved five laboratory experiments",
    "breaker": "Learn by Breaking - drove a simulation to failure and studied why",
    "mentor_chat": "Curious Mind - asked a professor a question",
}


def evaluate(session: Session, catalog: Catalog, student_id: str, states: dict | None = None) -> list[dict]:
    have = set(session.scalars(select(Achievement.code).where(Achievement.student_id == student_id)))
    earned: list[tuple[str, str]] = []

    def cond(code: str, ok: bool, title: str | None = None) -> None:
        if ok and code not in have:
            earned.append((code, title or DEFINITIONS[code]))

    cnt = lambda q: session.scalar(q) or 0  # noqa: E731
    cond("first_steps", True)
    cond("first_assessment", cnt(select(func.count()).select_from(AssessmentAttempt).where(
        AssessmentAttempt.student_id == student_id, AssessmentAttempt.passed.is_(True))) > 0)
    cond("first_mission", cnt(select(func.count()).select_from(Submission).where(
        Submission.student_id == student_id, Submission.passed.is_(True))) > 0)
    exps = list(session.scalars(select(Experiment).where(Experiment.student_id == student_id)))
    cond("experimenter", len(exps) >= 5)
    cond("breaker", any(e.summary.get("status") == "diverged" for e in exps))
    cond("mentor_chat", cnt(select(func.count()).select_from(Conversation).where(Conversation.student_id == student_id)) > 0)
    if states:
        for did, d in catalog.districts.items():
            cs = [c for c in catalog.concepts.values() if c["district"] == did]
            if cs:
                cond(f"district_{did}", all(states[c["id"]]["status"] == "mastered" for c in cs),
                     f"District Graduate - mastered every concept in {d['title']}")
    for code, title in earned:
        session.add(Achievement(student_id=student_id, code=code, title=title))
    session.flush()
    return [{"code": c, "title": t} for c, t in earned]
