"""Campus life API: identity, ID cards, the security gate, classmates and the student portal."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from nexora.api.context import AppContext, get_ctx, get_session, get_student
from nexora.core.errors import bad_request, not_found
from nexora.core.ids import utcnow
from nexora.infrastructure.database.models import (
    Achievement,
    AssessmentAttempt,
    Project,
    Student,
    StudentCard,
)
from nexora.modules.campus import engine as campus
from nexora.modules.learning import engine as learning
from nexora.modules.progression import engine as progression

router = APIRouter()


def _progress(session: Session, ctx: AppContext, student_id: str, tz: str | None = None) -> tuple[dict, dict]:
    states = learning.concept_states(session, ctx.catalog, student_id)
    return states, progression.summary(session, ctx.rules, student_id, states, learning.skill_levels(ctx.catalog, states), tz)


def _card(session: Session, student_id: str) -> StudentCard | None:
    return session.scalar(select(StudentCard).where(StudentCard.student_id == student_id))


@router.get("/campus")
def campus_info(ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    c = ctx.campus
    return {"university": c["university"], "departments": c["departments"],
            "students": [campus.public_npc(s, c) for s in c["students"].values()]}


class CardRequest(BaseModel):
    department: str = Field(max_length=32)
    track: str = Field(max_length=80)


@router.get("/students/{student_id}/id-card")
def get_card(student: Student = Depends(get_student), ctx: AppContext = Depends(get_ctx),
             session: Session = Depends(get_session)) -> dict[str, Any]:
    card = _card(session, student.id)
    if card is None:
        raise not_found("Student ID card")
    _, prog = _progress(session, ctx, student.id)
    return campus.card_view(card, student, ctx.campus, prog["rank"]["title"])


@router.post("/students/{student_id}/id-card", status_code=201)
def issue_card(body: CardRequest, student: Student = Depends(get_student), ctx: AppContext = Depends(get_ctx),
               session: Session = Depends(get_session)) -> dict[str, Any]:
    if _card(session, student.id) is not None:
        raise HTTPException(409, "A student ID has already been issued")
    try:
        card = campus.issue_card(session, ctx.campus, student.id, body.department, body.track)
    except ValueError as exc:
        raise bad_request(str(exc)) from exc
    _, prog = _progress(session, ctx, student.id)
    return campus.card_view(card, student, ctx.campus, prog["rank"]["title"])


class GateRequest(BaseModel):
    card_number: str | None = Field(None, max_length=24)


@router.post("/students/{student_id}/gate/verify")
def verify_gate(body: GateRequest, student: Student = Depends(get_student), session: Session = Depends(get_session)) -> dict[str, Any]:
    result = campus.gate_check(student, _card(session, student.id), body.card_number)
    if result["verified"] and result["first_time"]:
        student.settings = {**(student.settings or {}), "gate_first_entry_at": utcnow().isoformat()}
    return result


@router.post("/students/{student_id}/classmates/{npc_id}/talk")
def talk(npc_id: str, student: Student = Depends(get_student), ctx: AppContext = Depends(get_ctx),
         session: Session = Depends(get_session)) -> dict[str, Any]:
    if npc_id not in ctx.campus["students"]:
        raise not_found("Classmate")
    states, prog = _progress(session, ctx, student.id)
    recs = learning.recommendations(ctx.catalog, states)
    facts = {"mastered": prog["evidence"]["mastered_concepts"], "challenges_passed": prog["evidence"]["challenges_passed"],
             "next_title": recs[0]["title"] if recs else None}
    return campus.talk(session, ctx.campus, student, npc_id, facts)


@router.get("/students/{student_id}/classmates")
def classmates(student: Student = Depends(get_student), ctx: AppContext = Depends(get_ctx),
               session: Session = Depends(get_session)) -> list[dict[str, Any]]:
    return campus.relations(session, ctx.campus, student.id)


@router.get("/students/{student_id}/portal")
def portal(tz: str | None = Query(None, max_length=64), student: Student = Depends(get_student),
           ctx: AppContext = Depends(get_ctx), session: Session = Depends(get_session)) -> dict[str, Any]:
    states, prog = _progress(session, ctx, student.id, tz)
    card = _card(session, student.id)
    cat = ctx.catalog
    best = learning.mission_best(session, student.id)
    current = [{"id": c, "title": cat.concepts[c]["title"], "status": s["status"], "mastery": s["mastery"]}
               for c, s in states.items() if s["status"] in ("in_progress", "available")][:8]
    results = session.scalars(select(AssessmentAttempt).where(AssessmentAttempt.student_id == student.id)
                              .order_by(AssessmentAttempt.created_at.desc()).limit(10)).all()
    tz_obj = progression.parse_tz(tz)
    days = progression.activity_days(session, student.id, tz_obj)
    today = utcnow().date()
    recent = sum(1 for d in days if today - d <= timedelta(days=30))
    rels = campus.relations(session, ctx.campus, student.id)
    return {
        "disclaimer": ctx.campus["university"]["disclaimer"],
        "id_card": campus.card_view(card, student, ctx.campus, prog["rank"]["title"]) if card else None,
        "rank": prog["rank"], "xp": prog["xp"], "level": prog["level"]["level"],
        "current_courses": current,
        "assignments": [{"id": m["id"], "title": m["title"], "difficulty": m["difficulty"],
                         "status": "passed" if best.get(m["id"], {}).get("passed") else ("attempted" if m["id"] in best else "not started")}
                        for m in sorted(cat.missions.values(), key=lambda m: m["order"])],
        "results": [{"concept": cat.concepts[r.concept_id]["title"] if r.concept_id in cat.concepts else r.concept_id,
                     "score": r.score, "passed": r.passed, "date": r.created_at.date().isoformat()} for r in results],
        "skills": learning.skill_levels(cat, states),
        "participation": {"active_days_last_30": recent, "streak": prog["streak"]["current"],
                          "label": "Learning participation from your own activity - not institutional attendance."},
        "achievements": session.scalar(select(func.count()).select_from(Achievement).where(Achievement.student_id == student.id)) or 0,
        "projects": session.scalar(select(func.count()).select_from(Project).where(Project.student_id == student.id)) or 0,
        "classmates": {"known": len(rels), "friends": sum(r["status"] == "friend" for r in rels)},
        "hostel": None, "clubs": [], "not_yet_available": ["Hostel assignment", "Clubs", "Lecture attendance"],
    }
