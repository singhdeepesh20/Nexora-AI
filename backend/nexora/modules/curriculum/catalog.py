"""Curriculum catalog: loads and validates read-only content from the content directory.

The catalog is the single source of truth for districts, concepts, assessments,
missions and skills. It validates referential integrity and that the prerequisite
graph is acyclic, so a broken content edit fails loudly at startup and in CI.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from graphlib import CycleError, TopologicalSorter
from pathlib import Path
from typing import Any


class ContentError(ValueError):
    """Raised when curriculum content is invalid."""


@dataclass
class Catalog:
    root: Path
    curriculum: dict[str, Any]
    districts: dict[str, dict[str, Any]]
    concepts: dict[str, dict[str, Any]]
    lessons: dict[str, str]
    assessments: dict[str, dict[str, Any]]
    missions: dict[str, dict[str, Any]]
    skills: dict[str, dict[str, Any]]
    topo_order: list[str] = field(default_factory=list)
    content_hash: str = ""

    # ---- graph helpers
    def prerequisites(self, concept_id: str) -> list[str]:
        return list(self.concepts[concept_id]["prerequisites"])

    def dependents(self, concept_id: str) -> list[str]:
        return [c for c, d in self.concepts.items() if concept_id in d["prerequisites"]]

    def concepts_in_district(self, district_id: str) -> list[dict[str, Any]]:
        return sorted((c for c in self.concepts.values() if c["district"] == district_id), key=lambda c: c["order"])

    def mission_starter(self, mission_id: str) -> str:
        return (self.root / "missions" / mission_id / "starter.py").read_text(encoding="utf-8")

    def mission_tests(self, mission_id: str) -> str:
        m = self.missions[mission_id]
        return (self.root / "missions" / mission_id / m["test_file"]).read_text(encoding="utf-8")


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ContentError(f"Cannot read {path}: {exc}") from exc


def load_catalog(content_dir: Path) -> Catalog:
    content_dir = Path(content_dir)
    hasher = hashlib.sha256()
    for p in sorted(content_dir.rglob("*")):
        if p.is_file() and not p.name.startswith("."):
            hasher.update(str(p.relative_to(content_dir)).encode())
            hasher.update(p.read_bytes())

    curriculum = _read_json(content_dir / "curriculum" / "curriculum.json")
    districts = {d["id"]: d for d in curriculum["districts"]}
    skills = {s["id"]: s for s in _read_json(content_dir / "curriculum" / "skills.json")["skills"]}

    concepts: dict[str, dict[str, Any]] = {}
    lessons: dict[str, str] = {}
    assessments: dict[str, dict[str, Any]] = {}
    for path in sorted((content_dir / "concepts").glob("*.json")):
        c = _read_json(path)
        cid = c["id"]
        if cid in concepts:
            raise ContentError(f"Duplicate concept id {cid}")
        if c["district"] not in districts:
            raise ContentError(f"Concept {cid} references unknown district {c['district']}")
        concepts[cid] = c
        lesson = content_dir / "lessons" / c["lesson"]
        if not lesson.exists():
            raise ContentError(f"Concept {cid} lesson missing: {lesson}")
        lessons[cid] = lesson.read_text(encoding="utf-8")
        a = _read_json(content_dir / "assessments" / c["assessment"])
        _validate_assessment(cid, a)
        assessments[cid] = a

    missions: dict[str, dict[str, Any]] = {}
    for path in sorted((content_dir / "missions").glob("*/mission.json")):
        m = _read_json(path)
        if not (path.parent / "starter.py").exists() or not (path.parent / m["test_file"]).exists():
            raise ContentError(f"Mission {m['id']} is missing starter.py or tests")
        missions[m["id"]] = m

    # referential integrity
    for cid, c in concepts.items():
        for p in c["prerequisites"]:
            if p not in concepts:
                raise ContentError(f"Concept {cid} requires unknown concept {p}")
        for s in c["skills"]:
            if s not in skills:
                raise ContentError(f"Concept {cid} references unknown skill {s}")
        req = c["completion"].get("required_mission")
        if req and req not in missions:
            raise ContentError(f"Concept {cid} requires unknown mission {req}")
        for mid in c.get("missions", []):
            if mid not in missions:
                raise ContentError(f"Concept {cid} links unknown mission {mid}")
    for mid, m in missions.items():
        for ref in m["concepts"] + m["prerequisites"]:
            if ref not in concepts:
                raise ContentError(f"Mission {mid} references unknown concept {ref}")

    try:
        graph = {cid: set(c["prerequisites"]) for cid, c in concepts.items()}
        # Stable ordering: district number, then concept order, respecting prerequisites.
        ts = TopologicalSorter(graph)
        ts.prepare()
        order: list[str] = []
        key = lambda cid: (districts[concepts[cid]["district"]]["number"], concepts[cid]["order"], cid)  # noqa: E731
        while ts.is_active():
            ready = sorted(ts.get_ready(), key=key)
            order.extend(ready)
            ts.done(*ready)
    except CycleError as exc:
        raise ContentError(f"Prerequisite cycle detected: {exc.args[1]}") from exc

    return Catalog(content_dir, curriculum, districts, concepts, lessons, assessments, missions, skills,
                   order, hasher.hexdigest())


def _validate_assessment(cid: str, a: dict[str, Any]) -> None:
    if a.get("concept_id") != cid:
        raise ContentError(f"Assessment for {cid} has wrong concept_id")
    ids = set()
    for q in a["questions"]:
        if q["id"] in ids:
            raise ContentError(f"Assessment {cid} duplicate question {q['id']}")
        ids.add(q["id"])
        if q["type"] == "choice":
            if not (0 <= q["answer"] < len(q["options"])):
                raise ContentError(f"Assessment {cid}/{q['id']} answer index out of range")
        elif q["type"] == "numeric":
            float(q["answer"]), float(q["tolerance"])
        else:
            raise ContentError(f"Assessment {cid}/{q['id']} unknown type {q['type']}")
