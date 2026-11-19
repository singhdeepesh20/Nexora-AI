"""Application context and FastAPI dependencies (explicit dependency injection)."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass

from fastapi import Depends, Request
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

from nexora.core.config import Settings
from nexora.core.errors import not_found
from nexora.infrastructure.database.models import Student
from nexora.infrastructure.local_ai.ollama import ModelProvider
from nexora.infrastructure.storage.workspace import Workspace
from nexora.modules.curriculum.catalog import Catalog


@dataclass
class AppContext:
    settings: Settings
    engine: Engine
    session_factory: sessionmaker[Session]
    catalog: Catalog
    provider: ModelProvider | None
    workspace: Workspace
    schema_revision: str
    known_revisions: list[str]
    challenges: dict
    rules: dict
    daily: dict


def get_ctx(request: Request) -> AppContext:
    return request.app.state.ctx


def get_session(ctx: AppContext = Depends(get_ctx)) -> Iterator[Session]:
    session = ctx.session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_student(student_id: str, session: Session = Depends(get_session)) -> Student:
    student = session.get(Student, student_id)
    if student is None:
        raise not_found("Student")
    return student
