from nexora.infrastructure.local_ai.ollama import ProviderUnavailable


def chat(client, sid, mentor, msg, **kw):
    r = client.post(f"/api/v1/students/{sid}/mentors/{mentor}/chat", json={"message": msg, **kw})
    assert r.status_code == 200, r.text
    return r.json()


def test_ai_status_unavailable_is_graceful(client):
    s = client.get("/api/v1/ai/status").json()
    assert s["available"] is False and s["models"] == []


def test_offline_explain_uses_curriculum(client, student):
    r = chat(client, student, "newton", "why does a large learning rate diverge?")
    assert r["source"] == "fallback" and r["mode"] == "explain"
    assert r["references"][0]["concept_id"] == "ml.gradient_descent"
    assert "Gradient Descent" in r["reply"]


def test_socratic_mode_asks_questions_and_rotates(client, student):
    r1 = chat(client, student, "atlas", "cosine similarity of vectors", mode="socratic")
    r2 = chat(client, student, "atlas", "cosine similarity of vectors", mode="socratic",
              conversation_id=r1["conversation_id"])
    assert "?" in r1["reply"] and r1["reply"] != r2["reply"]
    conv = client.get(f"/api/v1/students/{student}/conversations/{r1['conversation_id']}").json()
    assert [m["role"] for m in conv["messages"]] == ["student", "mentor", "student", "mentor"]


def test_coding_mentor_explains_exception(client, student):
    r = chat(client, student, "ada", "I get Traceback ... line 7, in f\nKeyError: 'temp'")
    assert r["mode"] == "coding" and "KeyError" in r["reply"] and "line 7" in r["reply"]


def test_unknown_model_falls_back(client, student):
    r = chat(client, student, "nova", "what is attention", model="not-installed:1b")
    assert r["source"] == "fallback"


class FakeProvider:
    def __init__(self, fail=False):
        self.fail, self.calls = fail, []

    def status(self):
        return {"provider": "fake", "available": True, "models": [{"name": "tiny"}]}

    def chat(self, model, messages):
        self.calls.append(messages)
        if self.fail:
            raise ProviderUnavailable("down")
        return "model answer"


def test_local_model_used_with_grounding(app, client, student):
    fake = FakeProvider()
    app.state.ctx.provider = fake
    r = chat(client, student, "neural", "explain backpropagation chain rule", model="tiny")
    assert r["source"] == "ollama:tiny" and r["reply"] == "model answer"
    system = fake.calls[0][0]["content"]
    assert "Professor Neural" in system and "Curriculum excerpts" in system and "Backpropagation" in system


def test_model_failure_falls_back(app, client, student):
    app.state.ctx.provider = FakeProvider(fail=True)
    r = chat(client, student, "neural", "explain relu", model="tiny")
    assert r["source"] == "fallback" and "could not be reached" in r["reply"]
