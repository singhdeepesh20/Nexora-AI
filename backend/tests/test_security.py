from fastapi.testclient import TestClient


def test_token_required(app):
    c = TestClient(app)
    assert c.get("/api/v1/health").status_code == 200
    assert c.get("/api/v1/world").status_code == 401
    assert c.get("/api/v1/world", headers={"x-nexora-token": "wrong"}).status_code == 401


def test_dns_rebinding_host_rejected(client):
    assert client.get("/api/v1/world", headers={"host": "evil.example.com"}).status_code == 403
    assert client.get("/api/v1/world", headers={"host": "127.0.0.1:8765"}).status_code == 200


def test_no_permissive_cors(client):
    r = client.get("/api/v1/health", headers={"origin": "https://evil.example.com"})
    assert "access-control-allow-origin" not in {k.lower() for k in r.headers}


def test_ollama_url_must_be_loopback():
    import pytest

    from nexora.infrastructure.local_ai.ollama import OllamaProvider
    with pytest.raises(ValueError):
        OllamaProvider("http://example.com:11434")


def test_workspace_rejects_traversal(client, student):
    pid = client.post(f"/api/v1/students/{student}/projects", json={"name": "lab"}).json()["id"]
    for bad in ("..%2Fx.py", "a b.py", "x.exe", ".hidden.py"):
        r = client.put(f"/api/v1/students/{student}/projects/{pid}/files/{bad}", json={"content": "x"})
        assert r.status_code in (400, 404), bad


def test_cannot_access_other_students_project(client, student):
    other = client.post("/api/v1/students", json={"display_name": "Other"}).json()["id"]
    pid = client.post(f"/api/v1/students/{student}/projects", json={"name": "lab"}).json()["id"]
    assert client.get(f"/api/v1/students/{other}/projects/{pid}/files/main.py").status_code == 404
