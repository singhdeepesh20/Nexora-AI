from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, literal_column, select
from sqlalchemy.orm import Session

from nexora.api.context import AppContext, get_ctx, get_session, get_student
from nexora.core.errors import bad_request, forbidden, not_found
from nexora.core.ids import utcnow
from nexora.infrastructure.database.models import (
    AssessmentAttempt,
    Conversation,
    ConversationMessage,
    Experiment,
    Project,
    SkillEvidence,
    Student,
    Submission,
)
from nexora.infrastructure.storage.workspace import WorkspaceError
from nexora.modules.achievements import rules as achievements
from nexora.modules.assessments.grader import grade, public_view
from nexora.modules.curriculum.sync import search_content
from nexora.modules.learning import engine as learning
from nexora.modules.mentors.engine import MentorEngine
from nexora.modules.mentors.personas import PERSONAS
from nexora.modules.missions.evaluator import evaluate
from nexora.modules.progression import engine as progression
from nexora.modules.simulations.events import classify
from nexora.modules.simulations.ml_lab import dataset_info
from nexora.modules.simulations.registry import SIMULATIONS, run_simulation, summarize
from nexora.workers.sandbox import Limits, run_python

router = APIRouter()


# ------------------------------------------------------------------ world & curriculum
@router.get("/world")
def world(ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    cat = ctx.catalog
    districts = []
    for d in sorted(cat.districts.values(), key=lambda d: d["number"]):
        districts.append({**d, "concepts": [c["id"] for c in cat.concepts_in_district(d["id"])],
                          "missions": sorted([m["id"] for m in cat.missions.values() if m["district"] == d["id"]],
                                             key=lambda m: cat.missions[m]["order"]),
                          "simulations": [s.id for s in SIMULATIONS.values() if s.district == d["id"]]})
    return {"world": cat.curriculum["world"], "districts": districts, "curriculum_version": cat.curriculum["version"]}


def _concept_summary(c: dict[str, Any]) -> dict[str, Any]:
    return {k: c[k] for k in ("id", "district", "order", "title", "summary", "prerequisites", "simulations",
                              "missions", "skills")} | {"required_mission": c["completion"].get("required_mission")}


@router.get("/curriculum/concepts")
def list_concepts(ctx: AppContext = Depends(get_ctx)) -> list[dict[str, Any]]:
    return [_concept_summary(ctx.catalog.concepts[c]) for c in ctx.catalog.topo_order]


@router.get("/curriculum/concepts/{concept_id}")
def get_concept(concept_id: str, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    c = ctx.catalog.concepts.get(concept_id)
    if c is None:
        raise not_found("Concept")
    return {**c, "lesson_markdown": ctx.catalog.lessons[concept_id]}


@router.get("/curriculum/concepts/{concept_id}/assessment")
def get_assessment(concept_id: str, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    if concept_id not in ctx.catalog.assessments:
        raise not_found("Assessment")
    return public_view(ctx.catalog.assessments[concept_id])


@router.get("/curriculum/search")
def search(q: str = Query(min_length=1, max_length=200), session: Session = Depends(get_session)) -> list[dict]:
    return [{k: r[k] for k in ("kind", "ref_id", "title", "snip")} for r in search_content(session, q, limit=10)]


# ------------------------------------------------------------------ learning state
@router.get("/students/{student_id}/learning")
def learning_state(student: Student = Depends(get_student), ctx: AppContext = Depends(get_ctx),
                   session: Session = Depends(get_session)) -> dict[str, Any]:
    states = learning.concept_states(session, ctx.catalog, student.id)
    return {"concepts": states, "recommendations": learning.recommendations(ctx.catalog, states),
            "skills": learning.skill_levels(ctx.catalog, states),
            "totals": {"mastered": sum(s["status"] == "mastered" for s in states.values()), "concepts": len(states)}}


@router.post("/students/{student_id}/concepts/{concept_id}/open")
def open_lesson(concept_id: str, student: Student = Depends(get_student), ctx: AppContext = Depends(get_ctx),
                session: Session = Depends(get_session)) -> dict[str, Any]:
    """Records that a lesson was opened. Deliberately does NOT affect mastery."""
    if concept_id not in ctx.catalog.concepts:
        raise not_found("Concept")
    p = learning.touch_progress(session, student.id, concept_id)
    p.lesson_opened_at = p.lesson_opened_at or utcnow()
    return {"ok": True}


class AssessmentSubmission(BaseModel):
    answers: dict[str, Any] = Field(default_factory=dict)


@router.post("/students/{student_id}/concepts/{concept_id}/assessment")
def submit_assessment(concept_id: str, body: AssessmentSubmission, student: Student = Depends(get_student),
                      ctx: AppContext = Depends(get_ctx), session: Session = Depends(get_session)) -> dict[str, Any]:
    cat = ctx.catalog
    if concept_id not in cat.assessments:
        raise not_found("Assessment")
    states = learning.concept_states(session, cat, student.id)
    if not learning.is_unlocked(states, concept_id):
        missing = ", ".join(cat.concepts[m]["title"] for m in states[concept_id]["missing_prerequisites"])
        raise forbidden(f"Master the prerequisites first: {missing}")
    a = cat.assessments[concept_id]
    result = grade(a, body.answers)
    attempt = AssessmentAttempt(student_id=student.id, concept_id=concept_id, assessment_version=a["version"],
                                answers=body.answers, results={"results": result["results"]},
                                score=result["score"], passed=result["passed"])
    session.add(attempt)
    p = learning.touch_progress(session, student.id, concept_id)
    p.assessment_attempts += 1
    p.best_assessment_score = max(p.best_assessment_score, result["score"])
    p.last_practiced_at = utcnow()
    session.flush()
    if result["passed"]:
        for sk in cat.concepts[concept_id]["skills"]:
            session.add(SkillEvidence(student_id=student.id, skill_id=sk, source_type="assessment",
                                      source_id=attempt.id, score=result["score"]))
    new_states = learning.concept_states(session, cat, student.id)
    xp = []
    if result["passed"]:
        xp.append(progression.award(session, ctx.rules, student.id, f"assessment:{concept_id}", "assessment", concept_id,
                                    ctx.rules["xp"]["assessment_pass"], f"Passed assessment: {cat.concepts[concept_id]['title']}"))
    if new_states[concept_id]["status"] == "mastered" and p.mastered_at is None:
        p.mastered_at = utcnow()
    xp += _mastery_xp(session, ctx, student.id, states, new_states)
    result["xp"] = [x for x in xp if x]
    result["concept_state"] = new_states[concept_id]
    result["unlocked"] = [c for c, s in new_states.items() if states[c]["status"] == "locked" and s["status"] != "locked"]
    result["achievements"] = achievements.evaluate(session, cat, student.id, new_states)
    return result


def _mastery_xp(session: Session, ctx: AppContext, student_id: str, before: dict, after: dict) -> list:
    out = []
    for cid, st in after.items():
        if st["status"] == "mastered" and before[cid]["status"] != "mastered":
            out.append(progression.award(session, ctx.rules, student_id, f"mastery:{cid}", "mastery", cid,
                                         ctx.rules["xp"]["concept_mastered"], f"Mastered: {ctx.catalog.concepts[cid]['title']}"))
    return out


@router.get("/students/{student_id}/assessments")
def assessment_history(student: Student = Depends(get_student), session: Session = Depends(get_session)) -> list[dict]:
    rows = session.scalars(select(AssessmentAttempt).where(AssessmentAttempt.student_id == student.id)
                           .order_by(AssessmentAttempt.created_at.desc()).limit(200))
    return [{"id": r.id, "concept_id": r.concept_id, "score": r.score, "passed": r.passed,
             "created_at": r.created_at.isoformat()} for r in rows]


# ------------------------------------------------------------------ simulations
@router.get("/simulations")
def list_simulations() -> list[dict[str, Any]]:
    return [{"id": s.id, "title": s.title, "district": s.district, "description": s.description, "kind": s.kind,
             "version": s.version, "config_schema": s.config_model.model_json_schema()} for s in SIMULATIONS.values()]


@router.get("/simulations/ml_lab/datasets")
def ml_datasets() -> dict[str, Any]:
    return dataset_info()


class SimulationRun(BaseModel):
    config: dict[str, Any] = Field(default_factory=dict)
    save: bool = True
    note: str = Field("", max_length=2000)


@router.post("/students/{student_id}/simulations/{sim_id}/run")
def run_sim(sim_id: str, body: SimulationRun, student: Student = Depends(get_student),
            ctx: AppContext = Depends(get_ctx), session: Session = Depends(get_session)) -> dict[str, Any]:
    if sim_id not in SIMULATIONS:
        raise not_found("Simulation")
    try:
        config, result = run_simulation(sim_id, body.config, ctx)
    except ValueError as exc:  # includes pydantic ValidationError
        raise HTTPException(422, str(exc)) from exc
    exp_id, earned, xp = None, [], None
    if body.save:
        e = Experiment(student_id=student.id, simulation=sim_id, engine_version=SIMULATIONS[sim_id].version,
                       config=config, summary=summarize(sim_id, result), note=body.note)
        session.add(e)
        session.flush()
        exp_id = e.id
        earned = achievements.evaluate(session, ctx.catalog, student.id)
        xp = progression.award_experiment(session, ctx.rules, student.id, e.id, sim_id)
    return {"events": classify(sim_id, config, result), "xp": [xp] if body.save and xp else [], "simulation": sim_id, "version": SIMULATIONS[sim_id].version, "config": config, "result": result,
            "experiment_id": exp_id, "achievements": earned}


@router.get("/students/{student_id}/experiments")
def list_experiments(student: Student = Depends(get_student), session: Session = Depends(get_session)) -> list[dict]:
    rows = session.scalars(select(Experiment).where(Experiment.student_id == student.id)
                           .order_by(Experiment.created_at.desc()).limit(200))
    return [{"id": e.id, "simulation": e.simulation, "engine_version": e.engine_version, "config": e.config,
             "summary": e.summary, "note": e.note, "created_at": e.created_at.isoformat()} for e in rows]


# ------------------------------------------------------------------ missions
@router.get("/students/{student_id}/missions")
def list_missions(student: Student = Depends(get_student), ctx: AppContext = Depends(get_ctx),
                  session: Session = Depends(get_session)) -> list[dict[str, Any]]:
    states = learning.concept_states(session, ctx.catalog, student.id)
    best = learning.mission_best(session, student.id)
    out = []
    for m in sorted(ctx.catalog.missions.values(), key=lambda m: m["order"]):
        missing = [c for c in m["prerequisites"] if states[c]["status"] != "mastered"]
        out.append({k: m[k] for k in ("id", "title", "difficulty", "district", "summary", "concepts", "prerequisites")}
                   | {"locked": bool(missing), "missing_prerequisites": missing, "best": best.get(m["id"])})
    return out


@router.get("/missions/{mission_id}")
def get_mission(mission_id: str, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    m = ctx.catalog.missions.get(mission_id)
    if m is None:
        raise not_found("Mission")
    return {**m, "starter_code": ctx.catalog.mission_starter(mission_id),
            "test_names": _test_names(ctx.catalog.mission_tests(mission_id))}


def _test_names(src: str) -> list[str]:
    import ast
    return [n.name for n in ast.parse(src).body if isinstance(n, ast.FunctionDef) and n.name.startswith("test_")]


class CodeSubmission(BaseModel):
    code: str = Field(min_length=1, max_length=200_000)


def _mission_project(session: Session, student_id: str, mission_id: str, title: str) -> Project:
    name = f"mission-{mission_id}"
    p = session.scalar(select(Project).where(Project.student_id == student_id, Project.name == name))
    if p is None:
        p = Project(student_id=student_id, name=name, kind="mission", description=f"Workspace for mission: {title}")
        session.add(p)
        session.flush()
    return p


@router.post("/students/{student_id}/missions/{mission_id}/submit")
def submit_mission(mission_id: str, body: CodeSubmission, student: Student = Depends(get_student),
                   ctx: AppContext = Depends(get_ctx), session: Session = Depends(get_session)) -> dict[str, Any]:
    cat = ctx.catalog
    m = cat.missions.get(mission_id)
    if m is None:
        raise not_found("Mission")
    states = learning.concept_states(session, cat, student.id)
    missing = [c for c in m["prerequisites"] if states[c]["status"] != "mastered"]
    if missing:
        raise forbidden("Master the prerequisites first: " + ", ".join(cat.concepts[c]["title"] for c in missing))
    result = evaluate(cat, mission_id, body.code)
    sub = Submission(student_id=student.id, mission_id=mission_id, code=body.code, result=result,
                     score=result["score"], passed=result["passed"])
    session.add(sub)
    proj = _mission_project(session, student.id, mission_id, m["title"])
    ctx.workspace.write(student.id, proj.id, "solution.py", body.code)
    session.flush()
    if result["passed"]:
        skills = {sk for c in m["concepts"] for sk in cat.concepts[c]["skills"]}
        for sk in sorted(skills):
            session.add(SkillEvidence(student_id=student.id, skill_id=sk, source_type="mission", source_id=sub.id,
                                      score=result["score"]))
        for cid, c in cat.concepts.items():
            if c["completion"].get("required_mission") == mission_id:
                learning.touch_progress(session, student.id, cid).last_practiced_at = utcnow()
    new_states = learning.concept_states(session, cat, student.id)
    for cid, s in new_states.items():
        if s["status"] == "mastered" and states[cid]["status"] != "mastered":
            learning.touch_progress(session, student.id, cid).mastered_at = utcnow()
    xp = []
    if result["passed"]:
        xp.append(progression.award(session, ctx.rules, student.id, f"mission:{mission_id}", "mission", mission_id,
                                    ctx.rules["xp"]["mission_pass"].get(m["difficulty"], 100), f"Mission passed: {m['title']}"))
    xp += _mastery_xp(session, ctx, student.id, states, new_states)
    result["xp"] = [x for x in xp if x]
    result["submission_id"] = sub.id
    result["achievements"] = achievements.evaluate(session, cat, student.id, new_states)
    result["newly_mastered"] = [c for c, s in new_states.items() if s["status"] == "mastered" and states[c]["status"] != "mastered"]
    return result


@router.get("/students/{student_id}/missions/{mission_id}/submissions")
def mission_submissions(mission_id: str, student: Student = Depends(get_student),
                        session: Session = Depends(get_session)) -> list[dict]:
    rows = session.scalars(select(Submission).where(Submission.student_id == student.id, Submission.mission_id == mission_id)
                           .order_by(Submission.created_at.desc()).limit(50))
    return [{"id": s.id, "score": s.score, "passed": s.passed, "created_at": s.created_at.isoformat(), "code": s.code}
            for s in rows]


# ------------------------------------------------------------------ projects (personal AI laboratory)
class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80, pattern=r"^[\w\- ]+$")
    description: str = Field("", max_length=2000)


def _own_project(session: Session, student_id: str, project_id: str) -> Project:
    p = session.get(Project, project_id)
    if p is None or p.student_id != student_id:
        raise not_found("Project")
    return p


@router.get("/students/{student_id}/projects")
def list_projects(student: Student = Depends(get_student), ctx: AppContext = Depends(get_ctx),
                  session: Session = Depends(get_session)) -> list[dict]:
    rows = session.scalars(select(Project).where(Project.student_id == student.id).order_by(Project.updated_at.desc()))
    return [{"id": p.id, "name": p.name, "description": p.description, "kind": p.kind,
             "updated_at": p.updated_at.isoformat(), "files": ctx.workspace.list_files(student.id, p.id)} for p in rows]


@router.post("/students/{student_id}/projects", status_code=201)
def create_project(body: ProjectCreate, student: Student = Depends(get_student), ctx: AppContext = Depends(get_ctx),
                   session: Session = Depends(get_session)) -> dict:
    p = Project(student_id=student.id, name=body.name.strip(), description=body.description)
    session.add(p)
    session.flush()
    ctx.workspace.write(student.id, p.id, "main.py", 'print("Hello from my NEXORA laboratory!")\n')
    return {"id": p.id, "name": p.name, "files": ctx.workspace.list_files(student.id, p.id)}


@router.delete("/students/{student_id}/projects/{project_id}", status_code=204)
def delete_project(project_id: str, student: Student = Depends(get_student), ctx: AppContext = Depends(get_ctx),
                   session: Session = Depends(get_session)) -> None:
    p = _own_project(session, student.id, project_id)
    session.delete(p)
    ctx.workspace.remove_project(student.id, project_id)


@router.get("/students/{student_id}/projects/{project_id}/files/{name}")
def read_file(project_id: str, name: str, student: Student = Depends(get_student), ctx: AppContext = Depends(get_ctx),
              session: Session = Depends(get_session)) -> dict:
    _own_project(session, student.id, project_id)
    try:
        return {"name": name, "content": ctx.workspace.read(student.id, project_id, name)}
    except FileNotFoundError as exc:
        raise not_found("File") from exc
    except WorkspaceError as exc:
        raise bad_request(str(exc)) from exc


class FileBody(BaseModel):
    content: str = Field(max_length=512_000)


@router.put("/students/{student_id}/projects/{project_id}/files/{name}")
def write_file(project_id: str, name: str, body: FileBody, student: Student = Depends(get_student),
               ctx: AppContext = Depends(get_ctx), session: Session = Depends(get_session)) -> dict:
    p = _own_project(session, student.id, project_id)
    try:
        ctx.workspace.write(student.id, project_id, name, body.content)
    except WorkspaceError as exc:
        raise bad_request(str(exc)) from exc
    p.updated_at = utcnow()
    return {"ok": True, "files": ctx.workspace.list_files(student.id, project_id)}


@router.delete("/students/{student_id}/projects/{project_id}/files/{name}")
def delete_file(project_id: str, name: str, student: Student = Depends(get_student), ctx: AppContext = Depends(get_ctx),
                session: Session = Depends(get_session)) -> dict:
    _own_project(session, student.id, project_id)
    try:
        ctx.workspace.delete(student.id, project_id, name)
    except WorkspaceError as exc:
        raise bad_request(str(exc)) from exc
    return {"files": ctx.workspace.list_files(student.id, project_id)}


class RunRequest(BaseModel):
    entry: str = Field("main.py", max_length=80)


@router.post("/students/{student_id}/projects/{project_id}/run")
def run_project(project_id: str, body: RunRequest, student: Student = Depends(get_student),
                ctx: AppContext = Depends(get_ctx), session: Session = Depends(get_session)) -> dict:
    _own_project(session, student.id, project_id)
    files = ctx.workspace.read_all(student.id, project_id)
    try:
        r = run_python(files, "script", Limits(timeout_s=ctx.settings.sandbox_timeout_s,
                                               memory_mb=ctx.settings.sandbox_memory_mb), entry=body.entry)
    except ValueError as exc:
        raise bad_request(str(exc)) from exc
    return {"stdout": r.stdout, "stderr": r.stderr, "timed_out": r.timed_out, "exit_code": r.exit_code,
            "duration_ms": r.duration_ms, "error": (r.payload or {}).get("error"), "isolation": r.isolation}


# ------------------------------------------------------------------ mentors
@router.get("/mentors")
def mentors() -> list[dict]:
    return [{"id": k, **v} for k, v in PERSONAS.items()]


@router.get("/ai/status")
def ai_status(ctx: AppContext = Depends(get_ctx)) -> dict:
    if ctx.provider is None:
        return {"provider": None, "available": False, "models": []}
    return ctx.provider.status()


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    mode: str = Field("auto", pattern=r"^(auto|explain|socratic|coding|research)$")
    conversation_id: str | None = None
    model: str | None = Field(None, max_length=120)


@router.post("/students/{student_id}/mentors/{mentor_id}/chat")
def chat(mentor_id: str, body: ChatRequest, student: Student = Depends(get_student), ctx: AppContext = Depends(get_ctx),
         session: Session = Depends(get_session)) -> dict:
    if mentor_id not in PERSONAS:
        raise not_found("Mentor")
    model = body.model
    if model:
        status = ctx.provider.status() if ctx.provider else {"available": False, "models": []}
        if model not in {m["name"] for m in status["models"]}:
            model = None  # unavailable model -> graceful offline answer
    out = MentorEngine(session, ctx.catalog, ctx.provider).respond(student.id, mentor_id, body.message, body.mode,
                                                                   body.conversation_id, model)
    out["achievements"] = achievements.evaluate(session, ctx.catalog, student.id)
    return out


@router.get("/students/{student_id}/conversations")
def conversations(student: Student = Depends(get_student), session: Session = Depends(get_session)) -> list[dict]:
    rows = session.execute(select(Conversation, func.count(ConversationMessage.id))
                           .join(ConversationMessage, ConversationMessage.conversation_id == Conversation.id, isouter=True)
                           .where(Conversation.student_id == student.id).group_by(Conversation.id)
                           .order_by(Conversation.created_at.desc()).limit(100)).all()
    return [{"id": c.id, "mentor_id": c.mentor_id, "title": c.title, "messages": n, "created_at": c.created_at.isoformat()}
            for c, n in rows]


@router.get("/students/{student_id}/conversations/{conversation_id}")
def conversation(conversation_id: str, student: Student = Depends(get_student),
                 session: Session = Depends(get_session)) -> dict:
    c = session.get(Conversation, conversation_id)
    if c is None or c.student_id != student.id:
        raise not_found("Conversation")
    msgs = session.scalars(select(ConversationMessage).where(ConversationMessage.conversation_id == c.id)
                           .order_by(ConversationMessage.created_at, literal_column("conversation_messages.rowid")))
    return {"id": c.id, "mentor_id": c.mentor_id, "messages": [
        {"role": m.role, "content": m.content, "source": m.source, "created_at": m.created_at.isoformat()} for m in msgs]}
