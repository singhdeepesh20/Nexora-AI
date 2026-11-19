from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from nexora.api.context import AppContext, get_ctx, get_session, get_student
from nexora.core.config import APP_VERSION
from nexora.core.errors import bad_request
from nexora.infrastructure.database.models import Avatar, Student
from nexora.infrastructure.storage import backup
from nexora.modules.achievements import rules as achievements
from nexora.workers.sandbox import describe_isolation

router = APIRouter()


@router.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "app": "NEXORA", "version": APP_VERSION}


@router.get("/system")
def system(ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    return {"version": APP_VERSION, "data_dir": str(ctx.settings.data_dir), "schema_revision": ctx.schema_revision,
            "curriculum_version": ctx.catalog.curriculum["version"], "sandbox": describe_isolation(),
            "telemetry": "disabled - NEXORA never sends data anywhere"}


# ------------------------------------------------------------------ students
class StudentCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=60)
    body_color: str = Field("#2dd4bf", pattern=r"^#[0-9a-fA-F]{6}$")
    accent_color: str = Field("#38bdf8", pattern=r"^#[0-9a-fA-F]{6}$")

    @field_validator("display_name")
    @classmethod
    def _clean(cls, v: str) -> str:
        v = " ".join(v.split())
        if not v or any(ord(ch) < 32 for ch in v):
            raise ValueError("invalid display name")
        return v


class StudentSettings(BaseModel):
    graphics: str | None = Field(None, pattern=r"^(low|medium|high)$")
    mentor_model: str | None = Field(None, max_length=120)
    mentor_mode: str | None = Field(None, pattern=r"^(auto|explain|socratic|coding|research)$")
    show_fps: bool | None = None
    reduced_motion: bool | None = None
    onboarding: str | None = Field(None, pattern=r"^(pending|done|skipped)$")
    onboarding_started_at: str | None = Field(None, max_length=40)
    onboarding_completed_at: str | None = Field(None, max_length=40)


def _student_out(s: Student, a: Avatar | None) -> dict[str, Any]:
    return {"id": s.id, "display_name": s.display_name, "created_at": s.created_at.isoformat(),
            "settings": s.settings or {}, "avatar": None if a is None else
            {"body_color": a.body_color, "accent_color": a.accent_color, "position": a.position}}


@router.get("/students")
def list_students(session: Session = Depends(get_session)) -> list[dict[str, Any]]:
    out = []
    for s in session.scalars(select(Student).order_by(Student.created_at)):
        out.append(_student_out(s, session.scalar(select(Avatar).where(Avatar.student_id == s.id))))
    return out


@router.post("/students", status_code=201)
def create_student(body: StudentCreate, ctx: AppContext = Depends(get_ctx),
                   session: Session = Depends(get_session)) -> dict[str, Any]:
    s = Student(display_name=body.display_name, settings={"graphics": "medium", "mentor_mode": "auto"})
    session.add(s)
    session.flush()
    a = Avatar(student_id=s.id, body_color=body.body_color, accent_color=body.accent_color,
               position=dict(ctx.catalog.curriculum["world"]["spawn"]))
    session.add(a)
    session.flush()
    achievements.evaluate(session, ctx.catalog, s.id)
    return _student_out(s, a)


@router.get("/students/{student_id}")
def get_student_route(student: Student = Depends(get_student), session: Session = Depends(get_session)) -> dict[str, Any]:
    return _student_out(student, session.scalar(select(Avatar).where(Avatar.student_id == student.id)))


@router.patch("/students/{student_id}/settings")
def update_settings(body: StudentSettings, student: Student = Depends(get_student)) -> dict[str, Any]:
    merged = dict(student.settings or {})
    merged.update({k: v for k, v in body.model_dump().items() if v is not None})
    student.settings = merged
    return merged


class AvatarState(BaseModel):
    x: float = Field(ge=-500, le=500)
    z: float = Field(ge=-500, le=500)
    heading: float = Field(ge=-100, le=100)


@router.put("/students/{student_id}/avatar")
def save_avatar(body: AvatarState, student: Student = Depends(get_student),
                session: Session = Depends(get_session)) -> dict[str, Any]:
    a = session.scalar(select(Avatar).where(Avatar.student_id == student.id))
    if a is None:
        a = Avatar(student_id=student.id)
        session.add(a)
    a.position = body.model_dump()
    return a.position


@router.delete("/students/{student_id}", status_code=204)
def delete_student(student: Student = Depends(get_student), ctx: AppContext = Depends(get_ctx),
                   session: Session = Depends(get_session)) -> Response:
    sid = student.id
    session.delete(student)
    session.flush()
    ctx.workspace.remove_student(sid)
    return Response(status_code=204)


@router.get("/students/{student_id}/achievements")
def list_achievements(student: Student = Depends(get_student), session: Session = Depends(get_session)) -> list[dict]:
    from nexora.infrastructure.database.models import Achievement
    rows = session.scalars(select(Achievement).where(Achievement.student_id == student.id).order_by(Achievement.earned_at))
    return [{"code": a.code, "title": a.title, "earned_at": a.earned_at.isoformat()} for a in rows]


# ------------------------------------------------------------------ data ownership
@router.get("/data/export")
def export_data(student_id: str | None = None, ctx: AppContext = Depends(get_ctx),
                session: Session = Depends(get_session)) -> Response:
    ids = None
    if student_id:
        if session.get(Student, student_id) is None:
            raise HTTPException(404, "Student not found")
        ids = [student_id]
    data = backup.export_backup(session, ctx.settings.projects_dir, ctx.schema_revision, ids)
    from nexora.core.ids import utcnow
    name = f"nexora-backup-{utcnow().strftime('%Y%m%d-%H%M%S')}.zip"
    return Response(content=data, media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


MAX_UPLOAD = 300 * 1024 * 1024


@router.post("/data/import")
async def import_data(request: Request, ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > MAX_UPLOAD:
            raise bad_request("Backup file is too large")
    try:
        manifest, contents = backup.read_and_verify(bytes(body), ctx.known_revisions)
    except backup.BackupError as exc:
        raise bad_request(str(exc)) from exc
    # Safety copy of the current database before restoring.
    import shutil

    from nexora.core.ids import utcnow
    ctx.settings.backups_dir.mkdir(parents=True, exist_ok=True)
    safety = ctx.settings.backups_dir / f"pre-import-{utcnow().strftime('%Y%m%dT%H%M%S%f')}.db"
    with ctx.engine.connect() as conn:
        conn.exec_driver_sql("PRAGMA wal_checkpoint(FULL)")
    shutil.copy2(ctx.settings.database_path, safety)
    session = ctx.session_factory()
    try:
        summary = backup.import_backup(session, ctx.settings.projects_dir, manifest, contents)
        session.commit()
    except backup.BackupError as exc:
        session.rollback()
        raise bad_request(str(exc)) from exc
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
    summary["safety_copy"] = safety.name
    summary["backup_created_at"] = manifest["created_at"]
    return summary


@router.post("/data/delete-all")
def delete_all(confirm: str = Body(..., embed=True), ctx: AppContext = Depends(get_ctx)) -> dict[str, Any]:
    """Complete local deletion: all student rows, project files and safety copies; then VACUUM."""
    if confirm != "DELETE ALL MY DATA":
        raise bad_request("Confirmation text does not match")
    import shutil

    with ctx.session_factory() as session, session.begin():
        ids = list(session.scalars(select(Student.id)))
        session.execute(delete(Student))  # ON DELETE CASCADE removes every student-owned row
    for sid in ids:
        ctx.workspace.remove_student(sid)
    shutil.rmtree(ctx.settings.backups_dir, ignore_errors=True)
    ctx.settings.backups_dir.mkdir(parents=True, exist_ok=True)
    with ctx.engine.connect() as conn:
        conn.exec_driver_sql("VACUUM")
    return {"deleted_students": len(ids)}
