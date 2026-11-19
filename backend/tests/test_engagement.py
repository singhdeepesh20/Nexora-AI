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


