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


@router.post("/students/{student_id}/challenges/{challenge_id}/attempt")
def attempt_challenge(challenge_id: str, body: AttemptBody, student: Student = Depends(get_student),
                      ctx: AppContext = Depends(get_ctx), session: Session = Depends(get_session)) -> dict[str, Any]:
    c = ctx.challenges.get(challenge_id)
    if c is None:
        raise not_found("Challenge")
    try:
        r = challenges.attempt(c, body.config, ctx)
    except ValueError as exc:  # ChallengeError and pydantic ValidationError
        raise HTTPException(422, str(exc)) from exc
    already = session.scalar(select(ChallengeAttempt.id).where(ChallengeAttempt.student_id == student.id,
                                                               ChallengeAttempt.challenge_id == challenge_id,
                                                               ChallengeAttempt.passed.is_(True)))
    exp = Experiment(student_id=student.id, simulation=c["lab"], engine_version=SIMULATIONS[c["lab"]].version,
                     config=r["config"], summary=r["summary"], note=f"challenge:{challenge_id}")
    session.add(exp)
    att = ChallengeAttempt(student_id=student.id, kind="break", challenge_id=challenge_id, challenge_version=c["version"],
                           payload={k: r["config"][k] for k in c["allowed"]},
                           result={"checks": r["checks"], "metrics": r["metrics"], "events": [e["type"] for e in r["events"]]},
                           passed=r["passed"])
    session.add(att)
    session.flush()
    xp, earned = [], []
    if r["passed"]:
        a = progression.award(session, ctx.rules, student.id, f"challenge:{challenge_id}", "challenge", challenge_id,
                              int(c["xp"]), f"Solved: {c['title']}")
        xp += [a] if a else []
        if c.get("achievement") and not session.scalar(select(Achievement.id).where(
                Achievement.student_id == student.id, Achievement.code == f"challenge_{challenge_id}")):
            session.add(Achievement(student_id=student.id, code=f"challenge_{challenge_id}", title=c["achievement"]))
            earned.append({"code": f"challenge_{challenge_id}", "title": c["achievement"]})
    earned += achievements.evaluate(session, ctx.catalog, student.id)
    return {"challenge_id": challenge_id, "passed": r["passed"], "first_pass": r["passed"] and not already,
            "checks": r["checks"], "metrics": r["metrics"], "events": r["events"], "config": r["config"],
            "result": r["result"], "explanation": c["explanation"] if r["passed"] else None,
            "attempt_id": att.id, "xp": xp, "achievements": earned}


# ------------------------------------------------------------------ progression
@router.get("/students/{student_id}/progression")
def get_progression(tz: str | None = Query(None, max_length=64), student: Student = Depends(get_student),
                    ctx: AppContext = Depends(get_ctx), session: Session = Depends(get_session)) -> dict[str, Any]:
    states = learning.concept_states(session, ctx.catalog, student.id)
    return progression.summary(session, ctx.rules, student.id, states, learning.skill_levels(ctx.catalog, states), tz)


# ------------------------------------------------------------------ Debug of the Day
def _local_day(raw: str) -> date:
    try:
        d = date.fromisoformat(raw)
    except ValueError as exc:
        raise bad_request("date must be YYYY-MM-DD") from exc
    today = utcnow().date()
    if abs((d - today).days) > 1:  # time zones span at most +/-1 day from UTC
        raise bad_request("Only today's puzzle is available")
    return d


def _daily_state(session: Session, student_id: str, number: int) -> tuple[DailySession | None, list[ChallengeAttempt]]:
    ds = session.scalar(select(DailySession).where(DailySession.student_id == student_id, DailySession.puzzle_number == number))
    rows = session.scalars(select(ChallengeAttempt).where(ChallengeAttempt.student_id == student_id,
                                                          ChallengeAttempt.kind == "daily",
                                                          ChallengeAttempt.challenge_id == f"daily-{number}")
                           .order_by(ChallengeAttempt.created_at)).all()
    return ds, list(rows)


def _daily_view(number: int, p: dict, ds: DailySession | None, rows: list[ChallengeAttempt]) -> dict[str, Any]:
    solved = bool(ds and ds.solved_at)
    grid = [r.result["outcomes"] for r in rows if not ds or not ds.solved_at or r.created_at <= ds.solved_at]
    secs = int((ds.solved_at - ds.started_at).total_seconds()) if solved else None
    return {"number": number, "puzzle_id": p["id"], "version": p["version"], "title": p["title"], "topic": p["topic"],
            "description": p["description"], "starter_code": p["broken"], "hidden_tests": daily.test_count(p),
            "started_at": ds.started_at.isoformat() if ds else None, "solved": solved, "seconds": secs,
            "attempts": grid, "explanation": p["explanation"] if solved else None,
            "share_text": daily.share_text(number, grid, solved, secs) if solved else None}


@router.get("/students/{student_id}/daily")
def get_daily(date_: str = Query(..., alias="date"), student: Student = Depends(get_student),
              ctx: AppContext = Depends(get_ctx), session: Session = Depends(get_session)) -> dict[str, Any]:
    day = _local_day(date_)
    number, p = daily.puzzle_for(day, ctx.daily)
    ds, rows = _daily_state(session, student.id, number)
    return _daily_view(number, p, ds, rows) | {"calendar_note": ctx.daily["calendar"]["note"]}


class DailyBody(BaseModel):
    date: str
    code: str | None = Field(None, max_length=100_000)


@router.post("/students/{student_id}/daily/start")
def start_daily(body: DailyBody, student: Student = Depends(get_student), ctx: AppContext = Depends(get_ctx),
                session: Session = Depends(get_session)) -> dict[str, Any]:
    day = _local_day(body.date)
    number, p = daily.puzzle_for(day, ctx.daily)
    ds, _ = _daily_state(session, student.id, number)
    if ds is None:
        ds = DailySession(student_id=student.id, puzzle_number=number, puzzle_id=p["id"], local_date=day.isoformat())
        session.add(ds)
        session.flush()
    return {"number": number, "started_at": ds.started_at.isoformat()}


