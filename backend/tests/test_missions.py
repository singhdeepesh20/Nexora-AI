import pytest

from nexora.modules.missions.evaluator import evaluate
from nexora.modules.missions.quality import analyze
from tests.conftest import SOLUTIONS, master_with_prereqs

MISSIONS = ["python_fundamentals", "dataset_explorer", "build_classifier", "train_neural_network", "build_rag"]


@pytest.mark.parametrize("mid", MISSIONS)
def test_reference_solution_passes(catalog, mid):
    r = evaluate(catalog, mid, (SOLUTIONS / f"{mid}.py").read_text())
    failing = [t for t in r["tests"] if t["status"] != "passed"]
    assert r["passed"], (r["problem"], failing)
    assert r["categories"]["correctness"]["total"] >= 2 and r["categories"]["reliability"]["total"] >= 1


@pytest.mark.parametrize("mid", MISSIONS)
def test_starter_code_does_not_pass(catalog, mid):
    r = evaluate(catalog, mid, catalog.mission_starter(mid))
    assert not r["passed"] and r["categories"]["correctness"]["passed"] == 0
    assert any("not implemented" in t["message"] for t in r["tests"])


def test_partially_correct_solution_partial_score(catalog):
    code = (SOLUTIONS / "python_fundamentals.py").read_text().replace(
        "    if not values:\n        return []\n", "")
    r = evaluate(catalog, "python_fundamentals", code)
    assert not r["passed"] or r["categories"]["reliability"]["passed"] < r["categories"]["reliability"]["total"]
    assert 0 < r["score"] < 1


def test_infinite_loop_submission_times_out(catalog):
    from nexora.workers.sandbox import Limits
    r = evaluate(catalog, "python_fundamentals", "while True:\n    pass\n", Limits(timeout_s=2, cpu_s=5))
    assert not r["passed"] and "Time limit" in r["problem"] and r["score"] == 0


def test_syntax_error_reported(catalog):
    r = evaluate(catalog, "python_fundamentals", "def broken(:\n")
    assert not r["passed"] and r["syntax_error"] and "could not be imported" in r["problem"]


def test_quality_checks():
    q = analyze("from os import *\ndef f():\n    try:\n        pass\n    except:\n        pass\n")
    ids = {c["id"]: c["ratio"] for c in q["checks"]}
    assert ids["no_star_import"] == 0 and ids["no_bare_except"] == 0 and ids["docstrings"] == 0
    assert analyze('def f():\n    """Doc."""\n    return 1\n')["score"] == 1.0


def test_mission_api_enforces_prerequisites_and_records(client, student, catalog):
    code = (SOLUTIONS / "build_classifier.py").read_text()
    r = client.post(f"/api/v1/students/{student}/missions/build_classifier/submit", json={"code": code})
    assert r.status_code == 403
    missions = {m["id"]: m for m in client.get(f"/api/v1/students/{student}/missions").json()}
    assert missions["build_classifier"]["locked"] and not missions["python_fundamentals"]["locked"]
    master_with_prereqs(client, catalog, student, "ml.linear_regression")
    r = client.post(f"/api/v1/students/{student}/missions/build_classifier/submit", json={"code": code}).json()
    assert r["passed"] and r["isolation"]["timeout"]
    subs = client.get(f"/api/v1/students/{student}/missions/build_classifier/submissions").json()
    assert len(subs) == 1 and subs[0]["passed"]
    projects = client.get(f"/api/v1/students/{student}/projects").json()
    assert any(p["name"] == "mission-build_classifier" for p in projects)


def test_project_run_in_sandbox(client, student):
    pid = client.post(f"/api/v1/students/{student}/projects", json={"name": "My lab"}).json()["id"]
    client.put(f"/api/v1/students/{student}/projects/{pid}/files/helper.py", json={"content": "def two():\n    return 2\n"})
    client.put(f"/api/v1/students/{student}/projects/{pid}/files/main.py",
               json={"content": "from helper import two\nprint(two() * 21)\n"})
    r = client.post(f"/api/v1/students/{student}/projects/{pid}/run", json={"entry": "main.py"}).json()
    assert r["stdout"].strip() == "42" and r["error"] is None
