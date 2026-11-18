"""Learning engine: competency state, prerequisite enforcement, deterministic recommendations.

Rules (documented in docs/LEARNING_MODEL.md and enforced by tests):
* A concept is UNLOCKED when every prerequisite is MASTERED. Lessons of locked concepts may be
  previewed, but assessments and missions that depend on them are refused.
* A concept is MASTERED when its best assessment score >= pass score (0.8) AND, if the concept
  names a required mission, that mission has a passing submission.
* mastery (0..1) = best_assessment                                   (no required mission)
                 = 0.6 * best_assessment + 0.4 * best_mission_score   (with required mission)
* Opening a lesson never changes mastery.
* A mastered concept is due for REVIEW when not practised for REVIEW_AFTER_DAYS.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from nexora.core.ids import utcnow
from nexora.infrastructure.database.models import AssessmentAttempt, Progress, Submission
from nexora.modules.curriculum.catalog import Catalog

REVIEW_AFTER_DAYS = 14


def mission_best(session: Session, student_id: str) -> dict[str, dict[str, Any]]:
    rows = session.execute(
        select(Submission.mission_id, func.max(Submission.score), func.max(Submission.passed), func.count())
        .where(Submission.student_id == student_id).group_by(Submission.mission_id)
    ).all()
    return {m: {"best_score": float(s), "passed": bool(p), "attempts": int(n)} for m, s, p, n in rows}


def concept_states(session: Session, catalog: Catalog, student_id: str, now: datetime | None = None) -> dict[str, dict[str, Any]]:
    now = now or utcnow()
    progress = {p.concept_id: p for p in session.scalars(select(Progress).where(Progress.student_id == student_id))}
    missions = mission_best(session, student_id)
    wrong = dict(session.execute(
        select(AssessmentAttempt.concept_id, func.count()).where(
            AssessmentAttempt.student_id == student_id, AssessmentAttempt.passed.is_(False)
        ).group_by(AssessmentAttempt.concept_id)).all())
    states: dict[str, dict[str, Any]] = {}
    for cid in catalog.topo_order:  # prerequisites are always evaluated first
        c = catalog.concepts[cid]
        p = progress.get(cid)
        best = p.best_assessment_score if p else 0.0
        req = c["completion"].get("required_mission")
        mstate = missions.get(req) if req else None
        mission_ok = (mstate or {}).get("passed", False) if req else True
        mastery = best if not req else 0.6 * best + 0.4 * (mstate or {}).get("best_score", 0.0)
        mastered = best >= c["completion"]["assessment_pass_score"] - 1e-9 and mission_ok
        missing = [q for q in c["prerequisites"] if states[q]["status"] != "mastered"]
        if mastered:
            status = "mastered"
        elif missing:
            status = "locked"
        elif p and (p.assessment_attempts > 0 or (mstate or {}).get("attempts")):
            status = "in_progress"
        else:
            status = "available"
        last = p.last_practiced_at if p else None
        states[cid] = {
            "concept_id": cid, "status": status, "mastery": round(mastery, 4),
            "best_assessment_score": round(best, 4), "assessment_attempts": p.assessment_attempts if p else 0,
            "failed_attempts": int(wrong.get(cid, 0)),
            "required_mission": req, "required_mission_passed": mission_ok if req else None,
            "missing_prerequisites": missing, "lesson_opened": bool(p and p.lesson_opened_at),
            "last_practiced_at": last.isoformat() if last else None,
            "review_due": bool(mastered and last and now - last > timedelta(days=REVIEW_AFTER_DAYS)),
        }
    return states


def is_unlocked(states: dict[str, dict[str, Any]], concept_id: str) -> bool:
    return not states[concept_id]["missing_prerequisites"]


def recommendations(catalog: Catalog, states: dict[str, dict[str, Any]], limit: int = 5) -> list[dict[str, Any]]:
    """Deterministic, explainable next steps (no AI involved)."""
    recs: list[dict[str, Any]] = []
    for cid in catalog.topo_order:
        s, c = states[cid], catalog.concepts[cid]
        if s["review_due"]:
            recs.append({"concept_id": cid, "kind": "review", "priority": 1,
                         "reason": f"You mastered '{c['title']}' over {REVIEW_AFTER_DAYS} days ago - a quick review keeps it fresh."})
        elif s["status"] == "in_progress":
            if s["best_assessment_score"] >= c["completion"]["assessment_pass_score"] and s["required_mission"]:
                recs.append({"concept_id": cid, "kind": "mission", "priority": 0, "mission_id": s["required_mission"],
                             "reason": f"Assessment passed - complete the '{catalog.missions[s['required_mission']]['title']}' "
                                       "mission to master this concept."})
            else:
                why = (f"You have {s['failed_attempts']} unsuccessful attempt(s). Re-read the lesson sections tied to the "
                       "questions you missed, then retry." if s["failed_attempts"] else "Finish what you started.")
                recs.append({"concept_id": cid, "kind": "continue", "priority": 0, "reason": why})
        elif s["status"] == "available":
            unlocks = [d for d in catalog.dependents(cid)]
            reason = ("Ready to learn: no prerequisites." if not c["prerequisites"] else "All prerequisites mastered.") + (f" Mastering it unlocks {len(unlocks)} more concept(s)." if unlocks else "")
            recs.append({"concept_id": cid, "kind": "learn", "priority": 2, "reason": reason})
    order = {cid: i for i, cid in enumerate(catalog.topo_order)}
    recs.sort(key=lambda r: (r["priority"], order[r["concept_id"]]))
    for r in recs:
        r["title"] = catalog.concepts[r["concept_id"]]["title"]
        r["district"] = catalog.concepts[r["concept_id"]]["district"]
    return recs[:limit]


def skill_levels(catalog: Catalog, states: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for sid, skill in catalog.skills.items():
        linked = [cid for cid, c in catalog.concepts.items() if sid in c["skills"]]
        level = sum(states[c]["mastery"] for c in linked) / len(linked) if linked else 0.0
        out.append({"skill_id": sid, "name": skill["name"], "description": skill["description"],
                    "level": round(level, 4), "concepts": linked,
                    "mastered_concepts": [c for c in linked if states[c]["status"] == "mastered"]})
    return out


def touch_progress(session: Session, student_id: str, concept_id: str) -> Progress:
    p = session.scalar(select(Progress).where(Progress.student_id == student_id, Progress.concept_id == concept_id))
    if p is None:
        p = Progress(student_id=student_id, concept_id=concept_id)
        session.add(p)
        session.flush()
    return p
