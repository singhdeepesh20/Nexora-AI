import io
import json
import zipfile

from fastapi.testclient import TestClient

from nexora.api.app import create_app
from tests.conftest import H, make_settings, master


def _populate(client, catalog, sid):
    master(client, catalog, sid, "math.vectors")
    client.post(f"/api/v1/students/{sid}/simulations/gradient_descent/run", json={"config": {}})
    pid = client.post(f"/api/v1/students/{sid}/projects", json={"name": "lab"}).json()["id"]
    client.put(f"/api/v1/students/{sid}/projects/{pid}/files/notes.md", json={"content": "# my notes"})
    client.post(f"/api/v1/students/{sid}/mentors/atlas/chat", json={"message": "dot product"})
    return pid


def test_export_import_roundtrip_on_another_machine(client, catalog, student, tmp_path):
    pid = _populate(client, catalog, student)
    before = client.get(f"/api/v1/students/{student}/learning").json()
    data = client.get("/api/v1/data/export").content
    manifest = json.loads(zipfile.ZipFile(io.BytesIO(data)).read("manifest.json"))
    assert manifest["format"] == "nexora-backup" and manifest["schema_revision"] and manifest["files"]

    other = TestClient(create_app(make_settings(tmp_path / "laptop2")), headers=H)  # a fresh install
    r = other.post("/api/v1/data/import", content=data, headers={"content-type": "application/zip"})
    assert r.status_code == 200, r.text
    assert r.json()["project_files"] >= 2
    after = other.get(f"/api/v1/students/{student}/learning").json()
    assert after["concepts"] == before["concepts"]
    assert other.get(f"/api/v1/students/{student}/projects/{pid}/files/notes.md").json()["content"] == "# my notes"
    assert len(other.get(f"/api/v1/students/{student}/experiments").json()) == 1
    assert len(other.get(f"/api/v1/students/{student}/conversations").json()) == 1


def test_restore_after_delete_all(client, catalog, student):
    _populate(client, catalog, student)
    data = client.get("/api/v1/data/export").content
    assert client.post("/api/v1/data/delete-all", json={"confirm": "nope"}).status_code == 400
    assert client.post("/api/v1/data/delete-all", json={"confirm": "DELETE ALL MY DATA"}).json()["deleted_students"] == 1
    assert client.get("/api/v1/students").json() == []
    assert client.post("/api/v1/data/import", content=data).status_code == 200
    assert client.get(f"/api/v1/students/{student}/learning").json()["concepts"]["math.vectors"]["status"] == "mastered"


def _rezip(data: bytes, mutate) -> bytes:
    src = zipfile.ZipFile(io.BytesIO(data))
    files = {n: src.read(n) for n in src.namelist()}
    mutate(files)
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as zf:
        for n, b in files.items():
            zf.writestr(n, b)
    return out.getvalue()


def test_tampered_backup_rejected(client, catalog, student):
    _populate(client, catalog, student)
    data = client.get("/api/v1/data/export").content

    def tamper(files):
        files["data/progress.json"] = files["data/progress.json"].replace(b"1.0", b"0.5")
    r = client.post("/api/v1/data/import", content=_rezip(data, tamper))
    assert r.status_code == 400 and "Integrity" in r.json()["detail"]


def test_path_traversal_rejected(client, student):
    data = client.get("/api/v1/data/export").content
    r = client.post("/api/v1/data/import", content=_rezip(data, lambda f: f.update({"../../evil.py": b"x"})))
    assert r.status_code == 400 and "Unsafe path" in r.json()["detail"]


def test_newer_schema_rejected(client, student):
    data = client.get("/api/v1/data/export").content

    def bump(files):
        m = json.loads(files["manifest.json"])
        m["schema_revision"] = "9999_future"
        files["manifest.json"] = json.dumps(m).encode()
    r = client.post("/api/v1/data/import", content=_rezip(data, bump))
    assert r.status_code == 400 and "newer" in r.json()["detail"]


def test_garbage_rejected(client):
    assert client.post("/api/v1/data/import", content=b"not a zip").status_code == 400
