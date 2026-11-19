"""Campus life: university identity, simulated ID cards, the security gate and classmates.

Everything is local and deterministic. Classmate dialogue is assembled from authored lines plus
facts read from the student's verified records - classmates never invent achievements.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from nexora.core.ids import utcnow
from nexora.infrastructure.database.models import CampusRelation, Student, StudentCard

FRIEND_AFTER = 3


def load_campus(content_dir: Path) -> dict[str, Any]:
    root = content_dir / "campus"
    campus = json.loads((root / "campus.json").read_text(encoding="utf-8"))
    roster = json.loads((root / "students.json").read_text(encoding="utf-8"))
    if any(s["age"] < 18 for s in roster["students"]):
        raise ValueError("All campus characters must be adults")
    deps = {d["id"] for d in campus["departments"]}
    for s in roster["students"]:
        if s["department"] not in deps:
            raise ValueError(f"Classmate {s['id']} has unknown department {s['department']}")
    campus["students"] = {s["id"]: s for s in roster["students"]}
    campus["departments_by_id"] = {d["id"]: d for d in campus["departments"]}
    return campus


# ------------------------------------------------------------------ ID card
def card_view(card: StudentCard, student: Student, campus: dict, rank_title: str, now: datetime | None = None) -> dict[str, Any]:
    now = now or utcnow()
    dep = campus["departments_by_id"][card.department]
    year = max(1, now.year - card.enrollment_year + (1 if now.month >= 8 else 0))
    return {"university": campus["university"]["name"], "card_number": card.card_number, "name": student.display_name,
            "department_id": card.department, "department": dep["name"], "track": card.track,
            "enrollment_year": card.enrollment_year, "academic_year": year, "semester": 1 if now.month >= 8 or now.month == 1 else 2,
            "rank": rank_title, "issued_at": card.issued_at.isoformat(),
            "notice": "Simulated student ID for NEXORA University (an educational simulation). The pattern on the card is decorative, not a security credential."}


def issue_card(session: Session, campus: dict, student_id: str, department: str, track: str) -> StudentCard:
    dep = campus["departments_by_id"].get(department)
    if dep is None:
        raise ValueError("Unknown department")
    if track not in dep["tracks"]:
        raise ValueError("Unknown track for this department")
    year = utcnow().year
    n = (session.scalar(select(func.count()).select_from(StudentCard)) or 0) + 1
    number = f"NXU-{year}-{n:05d}"
    while session.scalar(select(StudentCard.id).where(StudentCard.card_number == number)):
        n += 1
        number = f"NXU-{year}-{n:05d}"
    card = StudentCard(student_id=student_id, card_number=number, department=department, track=track, enrollment_year=year)
    session.add(card)
    session.flush()
    return card


def gate_check(student: Student, card: StudentCard | None, presented: str | None) -> dict[str, Any]:
    """The guard compares the presented card with the locally stored profile."""
    name = student.display_name
    if card is None:
        return {"verified": False, "reason": "no_card", "lines": [
            "Good morning! Welcome to NEXORA University.", "May I see your student ID card?",
            "I don't see a card for you yet. Please visit the Admission Office on your left - they'll issue your student ID."]}
    if presented != card.card_number:
        return {"verified": False, "reason": "mismatch", "lines": [
            "Hmm, this card doesn't match our records.", "Please check your student ID, or ask at the Admission Office."]}
    first = not (student.settings or {}).get("gate_first_entry_at")
    lines = ([f"Good morning, {name}! Welcome to NEXORA University.", "Thank you - your student ID checks out.",
              "Head up the main avenue - the central plaza and the Experiment Machine are straight ahead."]
             if first else [f"Welcome back, {name}! Have a productive day."])
    return {"verified": True, "reason": "ok", "first_time": first, "lines": lines}


# ------------------------------------------------------------------ classmates
def relation_status(r: CampusRelation | None) -> str:
    if r is None or r.conversations == 0:
        return "stranger"
    return "friend" if r.conversations >= FRIEND_AFTER else "acquaintance"


def talk(session: Session, campus: dict, student: Student, npc_id: str, facts: dict[str, Any]) -> dict[str, Any]:
    npc = campus["students"].get(npc_id)
    if npc is None:
        raise KeyError(npc_id)
    rel = session.scalar(select(CampusRelation).where(CampusRelation.student_id == student.id, CampusRelation.npc_id == npc_id))
    first = rel is None
    if rel is None:
        rel = CampusRelation(student_id=student.id, npc_id=npc_id, conversations=0)
        session.add(rel)
    n = rel.conversations
    dep = campus["departments_by_id"][npc["department"]]["name"]
    first_name = npc["name"].split()[0]
    lines = []
    if first:
        lines.append(f"Hey! I'm {first_name}. I study {dep}. Are you also studying Artificial Intelligence?")
    else:
        lines.append(f"{student.display_name}! Good to see you again." if n + 1 > FRIEND_AFTER else f"Hi again, {student.display_name}.")
    lines.append(npc["lines"][n % len(npc["lines"])])
    # Context from verified records only.
    if facts.get("mastered", 0) >= 3:
        lines.append(f"You've already mastered {facts['mastered']} concepts? Maybe you can explain backprop to me sometime.")
    elif facts.get("next_title"):
        lines.append(f"What are you working on - {facts['next_title']}? That one's worth doing properly.")
    if facts.get("challenges_passed", 0):
        lines.append("I heard you've been solving break challenges. The Experiment Machine on the plaza is great for that.")
    rel.conversations = n + 1
    rel.updated_at = utcnow()
    session.flush()
    return {"npc": public_npc(npc, campus), "lines": lines, "relation": {"status": relation_status(rel), "conversations": rel.conversations,
            "friend_after": FRIEND_AFTER}}


def public_npc(npc: dict, campus: dict) -> dict[str, Any]:
    return {"id": npc["id"], "name": npc["name"], "archetype": npc["archetype"], "department": npc["department"],
            "department_name": campus["departments_by_id"][npc["department"]]["name"], "presentation": npc["presentation"]}


def relations(session: Session, campus: dict, student_id: str) -> list[dict[str, Any]]:
    rows = session.scalars(select(CampusRelation).where(CampusRelation.student_id == student_id)
                           .order_by(CampusRelation.updated_at.desc())).all()
    return [{**public_npc(campus["students"][r.npc_id], campus), "status": relation_status(r), "conversations": r.conversations,
             "met_at": r.met_at.isoformat()} for r in rows if r.npc_id in campus["students"]]
