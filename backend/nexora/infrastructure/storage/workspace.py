"""Student project workspaces on disk: <data_dir>/projects/<student_id>/<project_id>/<file>.

Frontend code never receives filesystem paths and can only address files by validated
flat names inside a project folder.
"""

from __future__ import annotations

import re
import shutil
from pathlib import Path

NAME_RE = re.compile(r"^[A-Za-z0-9_\-]{1,64}\.(py|md|txt|json|csv)$")
MAX_FILE_BYTES = 512_000
MAX_FILES_PER_PROJECT = 50


class WorkspaceError(ValueError):
    pass


def _uuidish(value: str) -> str:
    if not re.fullmatch(r"[0-9a-f\-]{36}", value):
        raise WorkspaceError("invalid identifier")
    return value


class Workspace:
    def __init__(self, root: Path):
        self.root = Path(root)

    def project_dir(self, student_id: str, project_id: str) -> Path:
        d = self.root / _uuidish(student_id) / _uuidish(project_id)
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _file(self, student_id: str, project_id: str, name: str) -> Path:
        if not NAME_RE.fullmatch(name):
            raise WorkspaceError("File names may contain letters, digits, '_' and '-', and end in .py .md .txt .json or .csv")
        return self.project_dir(student_id, project_id) / name

    def list_files(self, student_id: str, project_id: str) -> list[dict]:
        d = self.project_dir(student_id, project_id)
        return [{"name": p.name, "size": p.stat().st_size} for p in sorted(d.iterdir())
                if p.is_file() and not p.is_symlink() and NAME_RE.fullmatch(p.name)]

    def read(self, student_id: str, project_id: str, name: str) -> str:
        p = self._file(student_id, project_id, name)
        if not p.exists() or p.is_symlink():
            raise FileNotFoundError(name)
        return p.read_text(encoding="utf-8")

    def write(self, student_id: str, project_id: str, name: str, content: str) -> None:
        if len(content.encode("utf-8")) > MAX_FILE_BYTES:
            raise WorkspaceError(f"File exceeds {MAX_FILE_BYTES // 1000} KB")
        p = self._file(student_id, project_id, name)
        if not p.exists() and len(self.list_files(student_id, project_id)) >= MAX_FILES_PER_PROJECT:
            raise WorkspaceError("Too many files in this project")
        tmp = p.with_suffix(p.suffix + ".tmp")
        tmp.write_text(content, encoding="utf-8")
        tmp.replace(p)  # atomic on the same filesystem

    def delete(self, student_id: str, project_id: str, name: str) -> None:
        self._file(student_id, project_id, name).unlink(missing_ok=True)

    def read_all(self, student_id: str, project_id: str) -> dict[str, str]:
        return {f["name"]: self.read(student_id, project_id, f["name"]) for f in self.list_files(student_id, project_id)}

    def remove_project(self, student_id: str, project_id: str) -> None:
        shutil.rmtree(self.root / _uuidish(student_id) / _uuidish(project_id), ignore_errors=True)

    def remove_student(self, student_id: str) -> None:
        shutil.rmtree(self.root / _uuidish(student_id), ignore_errors=True)
