from __future__ import annotations

import warnings
from pathlib import Path

import pytest

warnings.filterwarnings("ignore", category=DeprecationWarning)
from fastapi.testclient import TestClient  # noqa: E402

from nexora.api.app import create_app  # noqa: E402
from nexora.core.config import REPO_ROOT, Settings  # noqa: E402

TOKEN = "test-token"
H = {"x-nexora-token": TOKEN}
SOLUTIONS = Path(__file__).parent / "fixtures" / "mission_solutions"


def make_settings(data_dir: Path) -> Settings:
    return Settings(data_dir=data_dir, content_dir=REPO_ROOT / "content", static_dir=None, access_token=TOKEN,
                    ollama_url="http://127.0.0.1:9")  # port 9: nothing listens -> AI unavailable


@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    return tmp_path / "nexora-data"


@pytest.fixture
def app(data_dir: Path):
    return create_app(make_settings(data_dir))


@pytest.fixture
def client(app) -> TestClient:
    c = TestClient(app)
    c.headers.update(H)
    return c


@pytest.fixture
def catalog(app):
    return app.state.ctx.catalog


@pytest.fixture
def student(client) -> str:
    return client.post("/api/v1/students", json={"display_name": "Test Student"}).json()["id"]


def correct_answers(catalog, concept_id: str) -> dict:
    out = {}
    for q in catalog.assessments[concept_id]["questions"]:
        out[q["id"]] = q["answer"]
    return out


def master(client, catalog, sid: str, concept_id: str) -> dict:
    """Pass a concept's assessment and, if required, its mission (using the reference solution)."""
    r = client.post(f"/api/v1/students/{sid}/concepts/{concept_id}/assessment",
                    json={"answers": correct_answers(catalog, concept_id)})
    assert r.status_code == 200, r.text
    req = catalog.concepts[concept_id]["completion"].get("required_mission")
    if req:
        code = (SOLUTIONS / f"{req}.py").read_text()
        r2 = client.post(f"/api/v1/students/{sid}/missions/{req}/submit", json={"code": code})
        assert r2.status_code == 200 and r2.json()["passed"], r2.text
    return r.json()


def master_with_prereqs(client, catalog, sid: str, concept_id: str) -> None:
    for cid in catalog.topo_order:
        if cid == concept_id or cid in _ancestors(catalog, concept_id):
            master(client, catalog, sid, cid)
        if cid == concept_id:
            return


def _ancestors(catalog, cid: str) -> set[str]:
    seen, stack = set(), list(catalog.concepts[cid]["prerequisites"])
    while stack:
        c = stack.pop()
        if c not in seen:
            seen.add(c)
            stack.extend(catalog.concepts[c]["prerequisites"])
    return seen
