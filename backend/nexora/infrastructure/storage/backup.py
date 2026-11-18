"""Portable, verifiable backups of student-owned data.

Format (documented in docs/BACKUP_FORMAT.md):

    nexora-backup-<timestamp>.zip
    ├── manifest.json            format, format_version, schema_revision, app_version, created_at,
    │                            student_ids, files: {path: {sha256, size}}
    ├── data/<table>.json        rows of every student-owned table (JSON, ISO-8601 datetimes)
    └── projects/<student_id>/<project_id>/<file>

Import verifies every SHA-256 before touching the database, rejects unsafe archive members
(absolute paths, '..', symlinks, oversized/too many entries), takes a safety copy of the
current database, then restores inside one transaction.
"""

from __future__ import annotations

import hashlib
import io
import json
import re
import shutil
import stat
import zipfile
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import Any

from sqlalchemy import DateTime, delete, select
from sqlalchemy.orm import Session

from nexora.core.config import APP_VERSION
from nexora.core.ids import utcnow
from nexora.infrastructure.database.models import STUDENT_TABLES, Student

FORMAT = "nexora-backup"
FORMAT_VERSION = 1
MAX_ENTRIES = 20_000
MAX_TOTAL_BYTES = 1_000_000_000
MAX_ENTRY_BYTES = 50_000_000
SAFE_PART = re.compile(r"^[A-Za-z0-9_.\-]+$")


class BackupError(ValueError):
    pass


def _row_to_json(obj: Any) -> dict[str, Any]:
    out = {}
    for col in obj.__table__.columns:
        v = getattr(obj, col.key)
        out[col.key] = v.isoformat() if isinstance(v, datetime) else v
    return out


def _student_filter(model, student_ids: list[str]):
    if model is Student:
        return Student.id.in_(student_ids)
    if hasattr(model, "student_id"):
        return model.student_id.in_(student_ids)
    # conversation_messages -> conversations
    from nexora.infrastructure.database.models import Conversation, ConversationMessage
    if model is ConversationMessage:
        return ConversationMessage.conversation_id.in_(select(Conversation.id).where(Conversation.student_id.in_(student_ids)))
    raise BackupError(f"Cannot scope table {model.__tablename__}")


def export_backup(session: Session, projects_root: Path, schema_revision: str, student_ids: list[str] | None = None) -> bytes:
    if student_ids is None:
        student_ids = list(session.scalars(select(Student.id)))
    files: dict[str, bytes] = {}
    for model in STUDENT_TABLES:
        rows = session.scalars(select(model).where(_student_filter(model, student_ids))).all()
        files[f"data/{model.__tablename__}.json"] = json.dumps([_row_to_json(r) for r in rows], indent=1).encode()
    for sid in student_ids:
        sdir = projects_root / sid
        if sdir.is_dir():
            for p in sorted(sdir.rglob("*")):
                if p.is_file() and not p.is_symlink():
                    files[f"projects/{p.relative_to(projects_root).as_posix()}"] = p.read_bytes()
    manifest = {
        "format": FORMAT, "format_version": FORMAT_VERSION, "schema_revision": schema_revision,
        "app_version": APP_VERSION, "created_at": utcnow().isoformat(), "student_ids": student_ids,
        "files": {name: {"sha256": hashlib.sha256(data).hexdigest(), "size": len(data)} for name, data in files.items()},
    }
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))
        for name, data in files.items():
            zf.writestr(name, data)
    return buf.getvalue()


def _safe_name(name: str) -> bool:
    p = PurePosixPath(name)
    return (not p.is_absolute() and "\\" not in name and all(part not in ("", ".", "..") and SAFE_PART.match(part)
                                                              for part in p.parts))


def read_and_verify(data: bytes, known_revisions: list[str]) -> tuple[dict[str, Any], dict[str, bytes]]:
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise BackupError("Not a valid NEXORA backup (not a zip archive)") from exc
    infos = zf.infolist()
    if len(infos) > MAX_ENTRIES:
        raise BackupError("Backup has too many entries")
    if sum(i.file_size for i in infos) > MAX_TOTAL_BYTES:
        raise BackupError("Backup is too large when uncompressed")
    contents: dict[str, bytes] = {}
    for info in infos:
        if info.is_dir():
            continue
        mode = info.external_attr >> 16
        if stat.S_ISLNK(mode):
            raise BackupError(f"Symlinks are not allowed in backups: {info.filename}")
        if not _safe_name(info.filename):
            raise BackupError(f"Unsafe path in backup: {info.filename!r}")
        if info.file_size > MAX_ENTRY_BYTES:
            raise BackupError(f"Entry too large: {info.filename}")
        contents[info.filename] = zf.read(info)
    try:
        manifest = json.loads(contents.pop("manifest.json"))
    except (KeyError, json.JSONDecodeError) as exc:
        raise BackupError("Backup manifest is missing or unreadable") from exc
    if manifest.get("format") != FORMAT or manifest.get("format_version") != FORMAT_VERSION:
        raise BackupError("Unsupported backup format or version")
    if manifest.get("schema_revision") not in known_revisions:
        raise BackupError(f"Backup schema revision {manifest.get('schema_revision')!r} is newer than this NEXORA version")
    declared = manifest.get("files", {})
    if set(declared) != set(contents):
        raise BackupError("Backup contents do not match its manifest")
    for name, meta in declared.items():
        if hashlib.sha256(contents[name]).hexdigest() != meta["sha256"]:
            raise BackupError(f"Integrity check failed for {name} - the backup is corrupted or was modified")
    return manifest, contents


def _coerce(model, row: dict[str, Any]) -> dict[str, Any]:
    cols = {c.key: c for c in model.__table__.columns}
    out = {}
    for k, v in row.items():
        if k not in cols:
            continue  # tolerate columns removed in newer schemas
        if isinstance(cols[k].type, DateTime) and isinstance(v, str):
            v = datetime.fromisoformat(v)
        out[k] = v
    return out


def import_backup(session: Session, projects_root: Path, manifest: dict[str, Any], contents: dict[str, bytes]) -> dict[str, Any]:
    """Restore students contained in the backup, replacing any existing data for those same students."""
    student_ids = list(manifest["student_ids"])
    for sid in student_ids:
        if not re.fullmatch(r"[0-9a-f\-]{36}", sid):
            raise BackupError("Invalid student id in manifest")
    tables = {}
    for model in STUDENT_TABLES:
        raw = contents.get(f"data/{model.__tablename__}.json", b"[]")
        rows = json.loads(raw)
        if not isinstance(rows, list):
            raise BackupError(f"Malformed table {model.__tablename__}")
        tables[model] = rows
    for row in tables[Student]:
        if row["id"] not in student_ids:
            raise BackupError("Backup contains a student not listed in its manifest")
    for model in reversed(STUDENT_TABLES):
        session.execute(delete(model).where(_student_filter(model, student_ids)))
    session.flush()
    counts = {}
    for model in STUDENT_TABLES:
        for row in tables[model]:
            session.add(model(**_coerce(model, row)))
        session.flush()
        counts[model.__tablename__] = len(tables[model])
    for sid in student_ids:
        shutil.rmtree(projects_root / sid, ignore_errors=True)
    restored_files = 0
    for name, data in contents.items():
        if name.startswith("projects/"):
            rel = PurePosixPath(name).relative_to("projects")
            if rel.parts[0] not in student_ids:
                raise BackupError("Project file belongs to an unknown student")
            target = (projects_root / Path(*rel.parts)).resolve()
            if not str(target).startswith(str(projects_root.resolve()) + "/") and not str(target).startswith(
                    str(projects_root.resolve()) + "\\"):
                raise BackupError("Unsafe project path")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            restored_files += 1
    return {"students": student_ids, "rows": counts, "project_files": restored_files}
