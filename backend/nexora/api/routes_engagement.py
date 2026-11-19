"""Engagement API: break challenges, progression, Debug of the Day and verified share cards."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from nexora.api.context import AppContext, get_ctx, get_session, get_student
from nexora.core.errors import bad_request, not_found
from nexora.core.ids import utcnow
from nexora.infrastructure.database.models import Achievement, ChallengeAttempt, DailySession, Experiment, Student
from nexora.modules.achievements import rules as achievements
from nexora.modules.challenges import engine as challenges
from nexora.modules.daily import engine as daily
from nexora.modules.learning import engine as learning
from nexora.modules.progression import engine as progression
from nexora.modules.sharing import cards
from nexora.modules.simulations.registry import SIMULATIONS

router = APIRouter()


# ------------------------------------------------------------------ break challenges
@router.get("/students/{student_id}/challenges")
def list_challenges(student: Student = Depends(get_student), ctx: AppContext = Depends(get_ctx),
                    session: Session = Depends(get_session)) -> list[dict[str, Any]]:
    rows = session.scalars(select(ChallengeAttempt).where(ChallengeAttempt.student_id == student.id,
                                                          ChallengeAttempt.kind == "break")).all()
    out = []
    for c in ctx.challenges.values():
        mine = [r for r in rows if r.challenge_id == c["id"]]
        out.append(challenges.public_view(c) | {"attempts": len(mine), "passed": any(r.passed for r in mine)})
    return out


@router.get("/challenges/{challenge_id}/hints/{n}")
def hint(challenge_id: str, n: int, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    c = ctx.challenges.get(challenge_id)
    if c is None or not 0 <= n < len(c["hints"]):
        raise not_found("Hint")
    return {"index": n, "hint": c["hints"][n], "remaining": len(c["hints"]) - n - 1}


class AttemptBody(BaseModel):
    config: dict[str, Any] = Field(default_factory=dict)


