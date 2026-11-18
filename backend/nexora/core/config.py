"""Runtime configuration.

All persistent student data lives in a platform-specific user data directory
(never inside the installed application). Content (curriculum, missions) is
read-only and shipped with the application.
"""

from __future__ import annotations

import os
import secrets
from dataclasses import dataclass, field
from pathlib import Path

from platformdirs import user_data_dir

from nexora import __version__

APP_NAME = "NEXORA"
APP_VERSION = __version__
API_PREFIX = "/api/v1"

# backend/nexora/core/config.py -> repository root is three levels above "nexora"
_PACKAGE_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = _PACKAGE_DIR.parent
REPO_ROOT = BACKEND_DIR.parent


def _default_data_dir() -> Path:
    override = os.environ.get("NEXORA_DATA_DIR")
    if override:
        return Path(override).expanduser().resolve()
    return Path(user_data_dir(APP_NAME, appauthor=False)).resolve()


def _default_content_dir() -> Path:
    override = os.environ.get("NEXORA_CONTENT_DIR")
    return Path(override).resolve() if override else REPO_ROOT / "content"


def _default_static_dir() -> Path | None:
    override = os.environ.get("NEXORA_STATIC_DIR")
    candidate = Path(override) if override else REPO_ROOT / "apps" / "web" / "dist"
    return candidate.resolve() if (candidate / "index.html").exists() else None


@dataclass(frozen=True)
class Settings:
    data_dir: Path = field(default_factory=_default_data_dir)
    content_dir: Path = field(default_factory=_default_content_dir)
    static_dir: Path | None = field(default_factory=_default_static_dir)
    host: str = "127.0.0.1"
    port: int = int(os.environ.get("NEXORA_PORT", "8765"))
    # Per-launch secret. The dev launcher passes it via NEXORA_TOKEN so the Vite proxy can attach it.
    access_token: str = field(default_factory=lambda: os.environ.get("NEXORA_TOKEN") or secrets.token_urlsafe(32))
    ollama_url: str = os.environ.get("NEXORA_OLLAMA_URL", "http://127.0.0.1:11434")
    extra_allowed_origins: tuple[str, ...] = ()
    sandbox_timeout_s: float = 10.0
    sandbox_memory_mb: int = 1024

    @property
    def database_path(self) -> Path:
        return self.data_dir / "nexora.db"

    @property
    def projects_dir(self) -> Path:
        return self.data_dir / "projects"

    @property
    def backups_dir(self) -> Path:
        return self.data_dir / "backups"

    @property
    def allowed_hosts(self) -> set[str]:
        return {"127.0.0.1", "localhost", "[::1]", "testserver"}

    def ensure_dirs(self) -> None:
        for d in (self.data_dir, self.projects_dir, self.backups_dir):
            d.mkdir(parents=True, exist_ok=True)
