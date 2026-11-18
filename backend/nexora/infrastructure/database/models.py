"""SQLAlchemy ORM models.

Student-owned records use UUID string primary keys. Catalog records (concepts,
missions, skills) use stable human-readable slugs from the content repository,
so progress keeps pointing at the right concept across curriculum updates.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from nexora.core.ids import new_id, utcnow


class Base(DeclarativeBase):
    type_annotation_map = {dict[str, Any]: JSON, list[Any]: JSON}


def _fk(target: str) -> Any:
    return ForeignKey(target, ondelete="CASCADE")


# ---------------------------------------------------------------- students
class Student(Base):
    __tablename__ = "students"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    display_name: Mapped[str] = mapped_column(String(60))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    settings: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class Avatar(Base):
    __tablename__ = "avatars"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    student_id: Mapped[str] = mapped_column(_fk("students.id"), unique=True)
    body_color: Mapped[str] = mapped_column(String(9), default="#2dd4bf")
    accent_color: Mapped[str] = mapped_column(String(9), default="#38bdf8")
    position: Mapped[dict[str, Any]] = mapped_column(JSON, default=lambda: {"x": 0.0, "z": 18.0, "heading": 3.14159})


# ---------------------------------------------------------------- catalog (synced from /content)
class Curriculum(Base):
    __tablename__ = "curriculum"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    version: Mapped[str] = mapped_column(String(32))
    content_hash: Mapped[str] = mapped_column(String(64))


class Module(Base):
    """A module corresponds to a university district."""

    __tablename__ = "modules"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    curriculum_id: Mapped[str] = mapped_column(_fk("curriculum.id"))
    title: Mapped[str] = mapped_column(String(120))
    order: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16))  # active | planned
    data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class Concept(Base):
    __tablename__ = "concepts"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    module_id: Mapped[str] = mapped_column(_fk("modules.id"))
    title: Mapped[str] = mapped_column(String(160))
    order: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    body_md: Mapped[str] = mapped_column(Text, default="")


class Prerequisite(Base):
    __tablename__ = "prerequisites"
    concept_id: Mapped[str] = mapped_column(_fk("concepts.id"), primary_key=True)
    requires_id: Mapped[str] = mapped_column(_fk("concepts.id"), primary_key=True)


class Mission(Base):
    __tablename__ = "missions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    difficulty: Mapped[str] = mapped_column(String(16))
    data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class Skill(Base):
    __tablename__ = "skills"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


# ---------------------------------------------------------------- learning records (student-owned)
class Progress(Base):
    __tablename__ = "progress"
    __table_args__ = (UniqueConstraint("student_id", "concept_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    student_id: Mapped[str] = mapped_column(_fk("students.id"), index=True)
    # Not a FK: progress must survive a curriculum update that renames/removes a concept.
    concept_id: Mapped[str] = mapped_column(String(64))
    lesson_opened_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    best_assessment_score: Mapped[float] = mapped_column(Float, default=0.0)
    assessment_attempts: Mapped[int] = mapped_column(Integer, default=0)
    mastered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_practiced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class AssessmentAttempt(Base):
    __tablename__ = "assessments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    student_id: Mapped[str] = mapped_column(_fk("students.id"), index=True)
    concept_id: Mapped[str] = mapped_column(String(64))
    assessment_version: Mapped[str] = mapped_column(String(64))
    answers: Mapped[dict[str, Any]] = mapped_column(JSON)
    results: Mapped[dict[str, Any]] = mapped_column(JSON)
    score: Mapped[float] = mapped_column(Float)
    passed: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Submission(Base):
    __tablename__ = "submissions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    student_id: Mapped[str] = mapped_column(_fk("students.id"), index=True)
    mission_id: Mapped[str] = mapped_column(String(64))
    code: Mapped[str] = mapped_column(Text)
    result: Mapped[dict[str, Any]] = mapped_column(JSON)
    score: Mapped[float] = mapped_column(Float)
    passed: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class SkillEvidence(Base):
    __tablename__ = "skill_evidence"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    student_id: Mapped[str] = mapped_column(_fk("students.id"), index=True)
    skill_id: Mapped[str] = mapped_column(String(64))
    source_type: Mapped[str] = mapped_column(String(16))  # assessment | mission | experiment
    source_id: Mapped[str] = mapped_column(String(36))
    score: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Experiment(Base):
    __tablename__ = "experiments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    student_id: Mapped[str] = mapped_column(_fk("students.id"), index=True)
    simulation: Mapped[str] = mapped_column(String(48))
    engine_version: Mapped[str] = mapped_column(String(16))
    config: Mapped[dict[str, Any]] = mapped_column(JSON)
    summary: Mapped[dict[str, Any]] = mapped_column(JSON)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    student_id: Mapped[str] = mapped_column(_fk("students.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(Text, default="")
    kind: Mapped[str] = mapped_column(String(16), default="personal")  # personal | mission
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    student_id: Mapped[str] = mapped_column(_fk("students.id"), index=True)
    mentor_id: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(160), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    conversation_id: Mapped[str] = mapped_column(_fk("conversations.id"), index=True)
    role: Mapped[str] = mapped_column(String(16))  # student | mentor
    content: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(48), default="")  # e.g. "fallback" or "ollama:llama3.2"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class MentorMemory(Base):
    __tablename__ = "mentor_memory"
    __table_args__ = (UniqueConstraint("student_id", "mentor_id", "key"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    student_id: Mapped[str] = mapped_column(_fk("students.id"), index=True)
    mentor_id: Mapped[str] = mapped_column(String(32))
    key: Mapped[str] = mapped_column(String(64))
    value: Mapped[dict[str, Any]] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Achievement(Base):
    __tablename__ = "achievements"
    __table_args__ = (UniqueConstraint("student_id", "code"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    student_id: Mapped[str] = mapped_column(_fk("students.id"), index=True)
    code: Mapped[str] = mapped_column(String(48))
    title: Mapped[str] = mapped_column(String(120))
    earned_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# Tables that hold student-owned data, in dependency order (parents first). Used by backup/export.
STUDENT_TABLES: list[type[Base]] = [
    Student, Avatar, Progress, AssessmentAttempt, Submission, SkillEvidence, Experiment,
    Project, Conversation, ConversationMessage, MentorMemory, Achievement,
]
