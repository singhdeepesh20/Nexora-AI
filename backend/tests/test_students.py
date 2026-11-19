from nexora.core.config import REPO_ROOT


def test_profile_lifecycle(client, data_dir):
    r = client.post("/api/v1/students", json={"display_name": "  Grace   Hopper "})
    assert r.status_code == 201
    s = r.json()
    assert s["display_name"] == "Grace Hopper" and s["avatar"]["position"]["z"] == 86  # starts outside the gate
    assert client.post("/api/v1/students", json={"display_name": ""}).status_code == 422
    assert [x["id"] for x in client.get("/api/v1/students").json()] == [s["id"]]
    assert client.patch(f"/api/v1/students/{s['id']}/settings", json={"graphics": "low"}).json()["graphics"] == "low"
    assert client.patch(f"/api/v1/students/{s['id']}/settings", json={"graphics": "ultra"}).status_code == 422
    pos = client.put(f"/api/v1/students/{s['id']}/avatar", json={"x": 3, "z": -4, "heading": 1.5}).json()
    assert pos == {"x": 3, "z": -4, "heading": 1.5}
    assert client.get(f"/api/v1/students/{s['id']}/achievements").json()[0]["code"] == "first_steps"
    client.post(f"/api/v1/students/{s['id']}/projects", json={"name": "lab"})
    assert any((data_dir / "projects" / s["id"]).iterdir())
    assert client.delete(f"/api/v1/students/{s['id']}").status_code == 204
    assert client.get(f"/api/v1/students/{s['id']}").status_code == 404
    assert not (data_dir / "projects" / s["id"]).exists()


def test_data_never_inside_app_bundle(data_dir):
    assert REPO_ROOT not in data_dir.parents


def test_persistence_across_restart(data_dir):
    from fastapi.testclient import TestClient

    from nexora.api.app import create_app
    from tests.conftest import H, make_settings
    c1 = TestClient(create_app(make_settings(data_dir)), headers=H)
    sid = c1.post("/api/v1/students", json={"display_name": "Persist"}).json()["id"]
    c1.put(f"/api/v1/students/{sid}/avatar", json={"x": 1, "z": 2, "heading": 0})
    c2 = TestClient(create_app(make_settings(data_dir)), headers=H)  # simulated restart
    s = c2.get(f"/api/v1/students/{sid}").json()
    assert s["display_name"] == "Persist" and s["avatar"]["position"]["x"] == 1
