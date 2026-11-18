from datetime import timedelta

from sqlalchemy import select

from nexora.core.ids import utcnow
from nexora.infrastructure.database.models import Progress
from nexora.modules.assessments.grader import grade
from tests.conftest import correct_answers, master, master_with_prereqs


def state(client, sid, cid):
    return client.get(f"/api/v1/students/{sid}/learning").json()["concepts"][cid]


def test_initial_state_roots_available_rest_locked(client, student, catalog):
    concepts = client.get(f"/api/v1/students/{student}/learning").json()["concepts"]
    for cid, s in concepts.items():
        expected = "available" if not catalog.concepts[cid]["prerequisites"] else "locked"
        assert s["status"] == expected, cid
        assert s["mastery"] == 0


def test_prerequisites_enforced(client, student, catalog):
    r = client.post(f"/api/v1/students/{student}/concepts/ml.gradient_descent/assessment",
                    json={"answers": correct_answers(catalog, "ml.gradient_descent")})
    assert r.status_code == 403 and "Derivatives" in r.json()["detail"]


def test_opening_lesson_does_not_change_mastery(client, student):
    client.post(f"/api/v1/students/{student}/concepts/math.vectors/open")
    s = state(client, student, "math.vectors")
    assert s["lesson_opened"] and s["mastery"] == 0 and s["status"] == "available"


def test_passing_assessment_masters_and_unlocks(client, student, catalog):
    r = master(client, catalog, student, "math.vectors")
    assert r["passed"] and r["score"] == 1.0
    assert r["concept_state"]["status"] == "mastered"
    assert "math.derivatives" in r["unlocked"]
    assert any(a["code"] == "first_assessment" for a in r["achievements"])


def test_failing_assessment_records_attempt(client, student):
    r = client.post(f"/api/v1/students/{student}/concepts/math.vectors/assessment", json={"answers": {"q1": 31}})
    body = r.json()
    assert not body["passed"] and body["score"] == 0.0
    s = state(client, student, "math.vectors")
    assert s["status"] == "in_progress" and s["failed_attempts"] == 1
    recs = client.get(f"/api/v1/students/{student}/learning").json()["recommendations"]
    assert recs[0]["concept_id"] == "math.vectors" and recs[0]["kind"] == "continue"


def test_required_mission_gates_mastery(client, student, catalog):
    r = client.post(f"/api/v1/students/{student}/concepts/python.basics/assessment",
                    json={"answers": correct_answers(catalog, "python.basics")})
    assert r.json()["passed"]
    s = r.json()["concept_state"]
    assert s["status"] == "in_progress" and s["required_mission"] == "python_fundamentals"
    assert s["mastery"] == 0.6  # 0.6 * 1.0 + 0.4 * 0
    recs = client.get(f"/api/v1/students/{student}/learning").json()["recommendations"]
    assert recs[0]["kind"] == "mission"
    master(client, catalog, student, "python.basics")
    s = state(client, student, "python.basics")
    assert s["status"] == "mastered" and s["mastery"] > 0.9


def test_grading_is_reproducible(catalog):
    a = catalog.assessments["stats.probability"]
    answers = {"q1": "5", "q2": 2.0004, "q3": 0.3, "q4": 1, "q5": "0.08"}
    r1, r2 = grade(a, answers), grade(a, answers)
    assert r1 == r2
    assert [x["correct"] for x in r1["results"]] == [True, True, False, True, True]
    assert r1["score"] == 0.8 and r1["passed"]


def test_grader_rejects_garbage(catalog):
    a = catalog.assessments["math.vectors"]
    r = grade(a, {"q1": "abc", "q2": float("nan"), "q4": "x"})
    assert r["score"] == 0


def test_review_due_after_two_weeks(client, app, student, catalog):
    master(client, catalog, student, "math.vectors")
    with app.state.ctx.session_factory() as s, s.begin():
        p = s.scalar(select(Progress).where(Progress.student_id == student, Progress.concept_id == "math.vectors"))
        p.last_practiced_at = utcnow() - timedelta(days=20)
    recs = client.get(f"/api/v1/students/{student}/learning").json()["recommendations"]
    assert recs[0] == recs[0] | {"concept_id": "math.vectors", "kind": "review"}


def test_skill_levels_follow_mastery(client, student, catalog):
    master_with_prereqs(client, catalog, student, "math.derivatives")
    skills = {s["skill_id"]: s for s in client.get(f"/api/v1/students/{student}/learning").json()["skills"]}
    math = skills["mathematical_foundations"]
    assert set(math["mastered_concepts"]) == {"math.vectors", "math.derivatives"}
    assert 0 < math["level"] < 1
