import io
import json
import zipfile

from fastapi.testclient import TestClient

from nexora.api.app import create_app
from nexora.core.config import REPO_ROOT
from nexora.modules.campus.engine import FRIEND_AFTER, load_campus
from tests.conftest import H, make_settings, master

CAMPUS = load_campus(REPO_ROOT / "content")


def test_roster_is_adult_and_diverse():
    students = list(CAMPUS["students"].values())
    assert len(students) == 30 and all(s["age"] >= 18 for s in students)
    assert {s["presentation"] for s in students} == {"F", "M"}
    assert len({s["archetype"] for s in students}) == 10
    assert len(CAMPUS["departments"]) == 9
    assert "not an accredited" in CAMPUS["university"]["disclaimer"]


def test_new_students_start_outside_the_gate(client):
    s = client.post("/api/v1/students", json={"display_name": "Arrival"}).json()
    world = client.get("/api/v1/world").json()["world"]
    assert s["avatar"]["position"]["z"] > world["entrance"]["gate_z"]


def test_arrival_flow_guard_admission_gate(client, student):
    base = f"/api/v1/students/{student}"
    no_card = client.post(f"{base}/gate/verify", json={}).json()
    assert not no_card["verified"] and no_card["reason"] == "no_card" and "Admission Office" in no_card["lines"][-1]
    assert client.get(f"{base}/id-card").status_code == 404
    assert client.post(f"{base}/id-card", json={"department": "nope", "track": "x"}).status_code == 400
    assert client.post(f"{base}/id-card", json={"department": "ml", "track": "Robotics"}).status_code == 400
    card = client.post(f"{base}/id-card", json={"department": "ml", "track": "Applied ML"}).json()
    assert card["card_number"].startswith("NXU-") and card["department"] == "Machine Learning" and card["rank"] == "Intern Engineer"
    assert "decorative" in card["notice"]
    assert client.post(f"{base}/id-card", json={"department": "ml", "track": "Applied ML"}).status_code == 409
    wrong = client.post(f"{base}/gate/verify", json={"card_number": "NXU-0000-99999"}).json()
    assert not wrong["verified"] and wrong["reason"] == "mismatch"
    first = client.post(f"{base}/gate/verify", json={"card_number": card["card_number"]}).json()
    assert first["verified"] and first["first_time"] and "Welcome to NEXORA University" in first["lines"][0]
    again = client.post(f"{base}/gate/verify", json={"card_number": card["card_number"]}).json()
    assert again["verified"] and not again["first_time"] and again["lines"][0].startswith("Welcome back")


def test_card_numbers_are_unique(client):
    nums = set()
    for i in range(4):
        sid = client.post("/api/v1/students", json={"display_name": f"S{i}"}).json()["id"]
        nums.add(client.post(f"/api/v1/students/{sid}/id-card", json={"department": "cse", "track": "Systems"}).json()["card_number"])
    assert len(nums) == 4


def test_classmate_relationship_grows_and_uses_verified_facts(client, student, catalog):
    url = f"/api/v1/students/{student}/classmates/s01/talk"
    r1 = client.post(url).json()
    assert r1["lines"][0].startswith("Hey! I'm Aisha") and r1["relation"]["status"] == "acquaintance"
    assert not any("mastered" in line for line in r1["lines"])  # nothing verified yet -> no claim
    r2 = client.post(url).json()
    assert r2["lines"][1] != r1["lines"][1]  # topics rotate between conversations
    for _ in range(FRIEND_AFTER - 2):
        r = client.post(url).json()
    assert r["relation"]["status"] == "friend" and r["relation"]["conversations"] == FRIEND_AFTER
    for cid in ("python.basics", "math.vectors", "math.derivatives"):
        master(client, catalog, student, cid)
    r4 = client.post(url).json()
    assert any("mastered 3 concepts" in line for line in r4["lines"])
    known = client.get(f"/api/v1/students/{student}/classmates").json()
    assert known[0]["id"] == "s01" and known[0]["status"] == "friend"
    assert client.post(f"/api/v1/students/{student}/classmates/zz/talk").status_code == 404


def test_portal_is_honest(client, student):
    base = f"/api/v1/students/{student}"
    client.post(f"{base}/id-card", json={"department": "genai", "track": "LLM Engineering"})
    p = client.get(f"{base}/portal").json()
    assert "not an accredited" in p["disclaimer"] and p["id_card"]["department"] == "Generative AI"
    assert "not institutional attendance" in p["participation"]["label"]
    assert p["hostel"] is None and "Hostel assignment" in p["not_yet_available"]
    assert len(p["assignments"]) == 5 and all(a["status"] == "not started" for a in p["assignments"])


def test_campus_records_are_in_backups(client, student, tmp_path):
    client.post(f"/api/v1/students/{student}/id-card", json={"department": "dl", "track": "Neural Networks"})
    client.post(f"/api/v1/students/{student}/classmates/s05/talk")
    data = client.get("/api/v1/data/export").content
    names = zipfile.ZipFile(io.BytesIO(data)).namelist()
    assert "data/student_cards.json" in names and "data/campus_relations.json" in names
    other = TestClient(create_app(make_settings(tmp_path / "laptop2")), headers=H)
    assert other.post("/api/v1/data/import", content=data).status_code == 200
    assert other.get(f"/api/v1/students/{student}/id-card").json()["department"] == "Deep Learning"
    assert json.loads(zipfile.ZipFile(io.BytesIO(data)).read("data/campus_relations.json"))[0]["npc_id"] == "s05"
