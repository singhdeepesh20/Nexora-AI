"""FastAPI application factory."""

from __future__ import annotations

import html
import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from starlette.requests import Request

from nexora.api import routes_core, routes_engagement, routes_learning
from nexora.api.context import AppContext
from nexora.core.config import API_PREFIX, APP_VERSION, Settings
from nexora.core.security import LocalAccessMiddleware
from nexora.infrastructure.database.session import (
    alembic_config,
    current_revision,
    make_engine,
    make_session_factory,
    migrate,
    transaction,
)
from nexora.infrastructure.local_ai.ollama import OllamaProvider
from nexora.infrastructure.storage.workspace import Workspace
from nexora.modules.challenges.engine import load_challenges
from nexora.modules.curriculum.catalog import load_catalog
from nexora.modules.curriculum.sync import sync_catalog
from nexora.modules.daily.engine import load_daily
from nexora.modules.progression.engine import load_rules

log = logging.getLogger("nexora")

CSP = ("default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; "
       "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; "
       "frame-ancestors 'none'; base-uri 'none'; form-action 'none'")


def build_context(settings: Settings) -> AppContext:
    from alembic.script import ScriptDirectory

    settings.ensure_dirs()
    engine = make_engine(settings.database_path)
    migrate(engine, settings.database_path, settings.backups_dir)
    script = ScriptDirectory.from_config(alembic_config(engine))
    known = [r.revision for r in script.walk_revisions()]
    catalog = load_catalog(settings.content_dir)
    factory = make_session_factory(engine)
    with transaction(factory) as s:
        sync_catalog(s, catalog)
    try:
        provider = OllamaProvider(settings.ollama_url)
    except ValueError:
        log.warning("Ignoring non-loopback Ollama URL; local AI disabled")
        provider = None
    return AppContext(settings=settings, engine=engine, session_factory=factory, catalog=catalog, provider=provider,
                      workspace=Workspace(settings.projects_dir), schema_revision=current_revision(engine) or "base",
                      known_revisions=known, challenges=load_challenges(settings.content_dir),
                      rules=load_rules(settings.content_dir), daily=load_daily(settings.content_dir))


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    ctx = build_context(settings)
    app = FastAPI(title="NEXORA", version=APP_VERSION, docs_url=f"{API_PREFIX}/docs",
                  openapi_url=f"{API_PREFIX}/openapi.json", redoc_url=None)
    app.state.ctx = ctx
    app.add_middleware(LocalAccessMiddleware, settings=settings)
    app.include_router(routes_core.router, prefix=API_PREFIX)
    app.include_router(routes_learning.router, prefix=API_PREFIX)
    app.include_router(routes_engagement.router, prefix=API_PREFIX)

    @app.exception_handler(KeyError)
    async def _key_error(_req: Request, exc: KeyError):  # unknown ids deep inside engines
        return JSONResponse({"detail": f"Not found: {exc}"}, status_code=404)

    if settings.static_dir:
        _mount_frontend(app, settings.static_dir, settings.access_token)
    else:
        @app.get("/", include_in_schema=False)
        def _root() -> HTMLResponse:
            return HTMLResponse("<h1>NEXORA backend</h1><p>Frontend build not found. Run <code>pnpm build</code> or use "
                                "the dev server (scripts/dev.sh).</p>")
    return app


def _mount_frontend(app: FastAPI, static_dir: Path, token: str) -> None:
    meta = f'<meta name="nexora-token" content="{html.escape(token)}">'
    root = static_dir.resolve()

    def page() -> str:  # re-read each time (a few KB) so a rebuilt frontend is served without restarting
        return (root / "index.html").read_text(encoding="utf-8").replace("<head>", "<head>\n    " + meta, 1)

    @app.get("/{path:path}", include_in_schema=False)
    def _spa(path: str):
        if path.startswith("api/"):
            return JSONResponse({"detail": "Not found"}, status_code=404)
        candidate = (root / path).resolve()
        if path and candidate.is_file() and str(candidate).startswith(str(root)) and candidate.name != "index.html":
            resp = FileResponse(candidate)
            if "/assets/" in f"/{path}":
                resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return resp
        return HTMLResponse(page(), headers={"Content-Security-Policy": CSP, "Cache-Control": "no-store"})
