"""Mirror the read-only catalog into SQLite (catalog tables + FTS5 search index)."""

from __future__ import annotations

from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session

from nexora.infrastructure.database.models import Concept, Curriculum, Mission, Module, Prerequisite, Skill
from nexora.modules.curriculum.catalog import Catalog

SYNC_FORMAT = "2"  # bump when the indexing logic changes so existing databases re-index


def sync_catalog(session: Session, catalog: Catalog) -> bool:
    """Replace catalog rows when content changed. Returns True if a sync happened.

    Student progress is keyed by concept slug (no FK), so it is never touched here.
    """
    cur = catalog.curriculum
    existing = session.get(Curriculum, cur["id"])
    stamp = f"{catalog.content_hash[:56]}:{SYNC_FORMAT}"
    if existing is not None and existing.content_hash == stamp:
        return False
    for model in (Prerequisite, Concept, Module, Mission, Skill, Curriculum):
        session.execute(delete(model))
    session.execute(text("DELETE FROM content_fts"))
    session.add(Curriculum(id=cur["id"], title=cur["title"], version=cur["version"], content_hash=stamp))
    session.flush()
    for d in catalog.districts.values():
        session.add(Module(id=d["id"], curriculum_id=cur["id"], title=d["title"], order=d["number"],
                           status=d["status"], data=d))
    session.flush()
    for cid, c in catalog.concepts.items():
        session.add(Concept(id=cid, module_id=c["district"], title=c["title"], order=c["order"], data=c,
                            body_md=catalog.lessons[cid]))
    session.flush()
    for cid, c in catalog.concepts.items():
        for p in c["prerequisites"]:
            session.add(Prerequisite(concept_id=cid, requires_id=p))
    for mid, m in catalog.missions.items():
        session.add(Mission(id=mid, title=m["title"], difficulty=m["difficulty"], data=m))
    for sid, s in catalog.skills.items():
        session.add(Skill(id=sid, name=s["name"], data=s))
    for cid, body in catalog.lessons.items():
        # index each lesson section separately so search results point at a focused passage
        for i, section in enumerate(_sections(body)):
            heading = section.splitlines()[0].lstrip("# ").strip()
            title = catalog.concepts[cid]["title"]
            session.execute(
                text("INSERT INTO content_fts(kind, ref_id, title, body) VALUES ('lesson', :r, :t, :b)"),
                {"r": f"{cid}#{i}", "t": title if heading == title else f"{title} - {heading}", "b": section},
            )
    for mid, m in catalog.missions.items():
        session.execute(
            text("INSERT INTO content_fts(kind, ref_id, title, body) VALUES ('mission', :r, :t, :b)"),
            {"r": mid, "t": m["title"], "b": m["summary"] + "\n" + m["description"]},
        )
    return True


def _sections(markdown: str) -> list[str]:
    parts, current = [], []
    for line in markdown.splitlines():
        if line.startswith("## ") and current:
            parts.append("\n".join(current).strip())
            current = []
        current.append(line)
    if current:
        parts.append("\n".join(current).strip())
    return [p for p in parts if p]


QUERY_STOPWORDS = set(
    "a an and are as at be by can do does for from how i in is it me of on or so the this to was what when where "
    "which who why will with you your explain tell about please".split())


def search_content(session: Session, query: str, limit: int = 5) -> list[dict]:
    terms = [t for t in "".join(ch if ch.isalnum() else " " for ch in query.lower()).split()
             if len(t) > 1 and t not in QUERY_STOPWORDS]
    if not terms:
        return []
    match = " OR ".join(f'"{t}"' for t in terms[:16])
    rows = session.execute(
        text("SELECT kind, ref_id, title, snippet(content_fts, 3, '[', ']', ' ... ', 24) AS snip, body, "
             "bm25(content_fts, 0.0, 0.0, 3.0, 1.0) AS score FROM content_fts WHERE content_fts MATCH :m ORDER BY score LIMIT :l"),
        {"m": match, "l": limit},
    ).mappings().all()
    return [dict(r) for r in rows]


__all__ = ["sync_catalog", "search_content", "select"]
