import json
import shutil

import pytest

from nexora.core.config import REPO_ROOT
from nexora.modules.curriculum.catalog import ContentError, load_catalog


def test_catalog_loads_and_is_consistent():
    cat = load_catalog(REPO_ROOT / "content")
    assert len(cat.districts) == 8
    assert {d["id"] for d in cat.districts.values() if d["status"] == "active"} == {
        "foundation", "machine_learning", "deep_learning"}
    assert len(cat.concepts) >= 12 and len(cat.missions) == 5
    pos = {c: i for i, c in enumerate(cat.topo_order)}
    for cid, c in cat.concepts.items():
        for p in c["prerequisites"]:
            assert pos[p] < pos[cid], f"{p} must come before {cid}"
    for cid, c in cat.concepts.items():
        for key in ("id", "title", "summary", "objectives", "prerequisites", "examples", "skills", "completion"):
            assert key in c, (cid, key)
        assert cat.lessons[cid].startswith("# ")
        assert len(cat.assessments[cid]["questions"]) >= 5


def _copy(tmp_path):
    dst = tmp_path / "content"
    shutil.copytree(REPO_ROOT / "content", dst)
    return dst


def test_cycle_detected(tmp_path):
    content = _copy(tmp_path)
    p = content / "concepts" / "math.vectors.json"
    c = json.loads(p.read_text())
    c["prerequisites"] = ["ml.gradient_descent"]
    p.write_text(json.dumps(c))
    with pytest.raises(ContentError, match="cycle"):
        load_catalog(content)


def test_unknown_prerequisite_detected(tmp_path):
    content = _copy(tmp_path)
    p = content / "concepts" / "math.vectors.json"
    c = json.loads(p.read_text())
    c["prerequisites"] = ["does.not.exist"]
    p.write_text(json.dumps(c))
    with pytest.raises(ContentError, match="unknown concept"):
        load_catalog(content)


def test_bad_answer_index_detected(tmp_path):
    content = _copy(tmp_path)
    p = content / "assessments" / "python.basics.json"
    a = json.loads(p.read_text())
    a["questions"][0]["answer"] = 99
    p.write_text(json.dumps(a))
    with pytest.raises(ContentError, match="out of range"):
        load_catalog(content)
