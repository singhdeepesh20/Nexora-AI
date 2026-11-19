from datetime import date, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import select

from nexora.core.config import REPO_ROOT
from nexora.core.ids import utcnow
from nexora.infrastructure.database.models import DailySession, Experiment, XPTransaction
from nexora.modules.challenges.engine import ChallengeError, attempt, build_config, load_challenges
from nexora.modules.daily import engine as daily
from nexora.modules.progression import engine as progression
from nexora.modules.simulations import gradient_descent as gd
from nexora.modules.simulations import infrastructure as infra
from nexora.modules.simulations import neural_network as nn
from nexora.modules.simulations.events import classify
from tests.conftest import correct_answers, master

FIXES = Path(__file__).parent / "fixtures" / "daily_fixes"
SOLUTIONS = {
    "onboarding.first_experiment": {"learning_rate": 0.3},
    "gd.diverge": {"learning_rate": 1.1},
    "gd.oscillation_onset": {"learning_rate": 0.52},
    "gd.valley_converge": {"learning_rate": 0.238},
    "gd.momentum": {"learning_rate": 0.334, "momentum": 0.4},
    "nn.underfit": {"hidden_layers": []},
    "nn.solve_xor": {"hidden_layers": [8], "optimizer": "adam", "learning_rate": 0.03, "epochs": 300},
    "nn.overfit": {"hidden_layers": [64, 64], "learning_rate": 0.03},
    "ml.overfit_tree": {"model": "decision_tree", "max_depth": None, "label_noise": 0.3},
    "ml.scaling": {"standardize": True, "n_neighbors": 7},
    "ml.f1": {"model": "logistic_regression", "standardize": True},
    "rag.break": {"chunk_size": 8, "overlap": 0, "b": 1.0, "k1": 5, "remove_stopwords": False},
    "rag.precision": {"chunk_size": 80, "overlap": 20, "b": 0.75, "remove_stopwords": True},
    "infra.oom": {"params_billion": 70},
    "infra.fit70b": {"precision": "int4"},
}
CHALLENGES = load_challenges(REPO_ROOT / "content")


class Ctx:
    def __init__(self, catalog):
        self.catalog = catalog


# ------------------------------------------------------------------ event classifier
def types(sim, cfg, res):
    return {e["type"] for e in classify(sim, cfg, res)}


def test_events_follow_simulation_output_gd():
    c = gd.GDConfig(learning_rate=1.1, iterations=200)
    assert "LOSS_DIVERGENCE" in types("gradient_descent", c.model_dump(), gd.run(c))
    c = gd.GDConfig(learning_rate=0.1, iterations=500)
    t = types("gradient_descent", c.model_dump(), gd.run(c))
    assert t == {"SUCCESSFUL_CONVERGENCE"}


def test_onboarding_network_really_diverges_then_converges():
    base = CHALLENGES["onboarding.first_experiment"]["initial_config"]
    bad = nn.NNConfig(**base)
    rb = nn.run(bad)
    assert "LOSS_DIVERGENCE" in types("neural_network", bad.model_dump(), rb)
    assert max(rb["history"]["train_loss"]) > 3 * rb["history"]["train_loss"][0]
    good = nn.NNConfig(**{**base, "learning_rate": 0.3})
    assert types("neural_network", good.model_dump(), nn.run(good)) == {"SUCCESSFUL_CONVERGENCE"}


def test_memory_overflow_event_is_labelled_estimate():
    c = infra.InfraConfig(params_billion=70, hardware="consumer_gpu_8gb", run_benchmark=False)
    ev = classify("infrastructure", c.model_dump(), infra.run(c))
    assert ev[0]["type"] == "MEMORY_OVERFLOW" and ev[0]["metrics"]["estimate"] is True


def test_events_are_deterministic():
    c = nn.NNConfig(dataset="moons", epochs=60, seed=4)
    assert classify("neural_network", c.model_dump(), nn.run(c)) == classify("neural_network", c.model_dump(), nn.run(c))


# ------------------------------------------------------------------ break challenges
@pytest.mark.parametrize("cid", sorted(CHALLENGES))
def test_challenge_starts_unsolved_and_is_solvable(catalog, cid):
    c = CHALLENGES[cid]
    assert not attempt(c, {}, Ctx(catalog))["passed"], "initial config must not already pass"
    r = attempt(c, SOLUTIONS[cid], Ctx(catalog))
    assert r["passed"], [ch for ch in r["checks"] if not ch["passed"]]


def test_every_challenge_has_a_tested_solution():
    assert set(SOLUTIONS) == set(CHALLENGES)


def test_fixed_settings_cannot_be_changed():
    with pytest.raises(ChallengeError):
        build_config(CHALLENGES["gd.diverge"], {"function": "rosenbrock"})


def test_challenge_api_awards_xp_once_and_hides_explanation_until_pass(client, student):
    url = f"/api/v1/students/{student}/challenges/gd.diverge/attempt"
    fail = client.post(url, json={"config": {"learning_rate": 0.1}}).json()
    assert not fail["passed"] and fail["explanation"] is None and fail["xp"] == []
    ok = client.post(url, json={"config": {"learning_rate": 1.1}}).json()
    assert ok["passed"] and ok["first_pass"] and ok["xp"][0]["xp"] == 30 and ok["explanation"]
    assert any(e["type"] == "LOSS_DIVERGENCE" for e in ok["events"])
    again = client.post(url, json={"config": {"learning_rate": 1.2}}).json()
    assert again["passed"] and not again["first_pass"] and again["xp"] == []  # no farming
    listed = {c["id"]: c for c in client.get(f"/api/v1/students/{student}/challenges").json()}
    assert listed["gd.diverge"]["passed"] and listed["gd.diverge"]["attempts"] == 3
    assert "hints" not in listed["gd.diverge"] and listed["gd.diverge"]["hint_count"] == 2
    assert client.post(url, json={"config": {"iterations": 5}}).status_code == 422


def test_onboarding_grants_achievement(client, student):
    url = f"/api/v1/students/{student}/challenges/onboarding.first_experiment/attempt"
    first = client.post(url, json={"config": {}}).json()
    assert not first["passed"] and any(e["type"] == "LOSS_DIVERGENCE" for e in first["events"])
    fixed = client.post(url, json={"config": {"learning_rate": 0.3}}).json()
    assert fixed["passed"] and any(a["title"] == "First Experiment Completed" for a in fixed["achievements"])
    card = client.get(f"/api/v1/students/{student}/share-card", params={"kind": "challenge", "ref": "onboarding.first_experiment"}).json()
    assert card["eyebrow"] == "FIRST EXPERIMENT COMPLETED" and card["stats"][0] == {"label": "Attempts", "value": "2"}
    assert card["stats"][1] == {"label": "Learning rate", "value": "0.3"}


# ------------------------------------------------------------------ progression
def test_xp_only_for_verified_actions(client, student, catalog):
    p0 = client.get(f"/api/v1/students/{student}/progression").json()
    assert p0["xp"] == 0 and p0["rank"]["id"] == "intern"
    client.post(f"/api/v1/students/{student}/concepts/math.vectors/open")
    client.post(f"/api/v1/students/{student}/concepts/math.vectors/assessment", json={"answers": {"q1": 1}})
    assert client.get(f"/api/v1/students/{student}/progression").json()["xp"] == 0  # reading/failing earns nothing
    r = client.post(f"/api/v1/students/{student}/concepts/math.vectors/assessment",
                    json={"answers": correct_answers(catalog, "math.vectors")}).json()
    assert sorted(x["xp"] for x in r["xp"]) == [40, 60]  # pass + mastery
    r2 = client.post(f"/api/v1/students/{student}/concepts/math.vectors/assessment",
                     json={"answers": correct_answers(catalog, "math.vectors")}).json()
    assert r2["xp"] == []
    assert client.get(f"/api/v1/students/{student}/progression").json()["xp"] == 100


def test_experiment_xp_is_capped_per_day(client, student):
    got = [client.post(f"/api/v1/students/{student}/simulations/gradient_descent/run", json={"config": {}}).json()["xp"]
           for _ in range(5)]
    assert [len(x) for x in got] == [1, 1, 1, 0, 0]


def test_rank_requires_evidence_not_just_xp(app, client, student, catalog):
    with app.state.ctx.session_factory() as s, s.begin():
        s.add(XPTransaction(student_id=student, award_key="test:bulk", source_type="test", source_id="x", xp=5000,
                            reason="injected", rule_version="1"))
    p = client.get(f"/api/v1/students/{student}/progression").json()
    assert p["xp"] == 5000 and p["rank"]["id"] == "intern"  # 5000 XP but no evidence
    missing = [c for c in p["rank"]["next"]["checks"] if not c["met"]]
    assert {c["unit"] for c in p["rank"]["next"]["checks"]} == {"count"}  # junior needs counts, not percentages
    assert {c["label"] for c in missing} >= {"Concepts mastered", "Missions passed"}
    master(client, catalog, student, "python.basics")
    master(client, catalog, student, "math.vectors")
    assert client.get(f"/api/v1/students/{student}/progression").json()["rank"]["id"] == "junior"


