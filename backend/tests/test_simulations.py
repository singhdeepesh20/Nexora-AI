import numpy as np
import pytest

from nexora.modules.simulations import gradient_descent as gd
from nexora.modules.simulations import infrastructure as infra
from nexora.modules.simulations import ml_lab, rag, transformer
from nexora.modules.simulations import neural_network as nn


def test_gd_converges_with_small_lr():
    r = gd.run(gd.GDConfig(function="quadratic", learning_rate=0.1, iterations=500))
    assert r["status"] == "converged" and abs(r["final"]["x"]) < 1e-5 and abs(r["final"]["y"]) < 1e-5


def test_gd_first_step_matches_hand_calculation():
    r = gd.run(gd.GDConfig(function="quadratic", a=1, b=1, learning_rate=0.25, start_x=4, start_y=0, iterations=1))
    assert r["path"][1][0] == pytest.approx(2.0)  # 4 - 0.25 * 8


def test_gd_diverges_above_stability_limit_and_explains():
    r = gd.run(gd.GDConfig(function="quadratic", a=1, b=1, learning_rate=1.05, iterations=2000))
    assert r["status"] == "diverged"
    assert r["analysis"]["stability_limit_lr"] == pytest.approx(1.0, rel=1e-3)
    assert any("exceeds the stability limit" in n for n in r["analysis"]["notes"])


def test_gd_divergence_detected_within_few_iterations():
    r = gd.run(gd.GDConfig(function="quadratic", a=1, b=1, learning_rate=1.05, iterations=100))
    assert r["status"] == "diverged" and r["iterations_run"] < 100


def test_gd_oscillates_exactly_at_limit():
    r = gd.run(gd.GDConfig(function="quadratic", a=1, b=1, learning_rate=1.0, start_x=3, start_y=0, iterations=10))
    xs = [p[0] for p in r["path"]]
    assert xs[:4] == pytest.approx([3, -3, 3, -3])
    assert r["status"] == "max_iterations"


def test_adam_makes_progress_on_rosenbrock():
    r = gd.run(gd.GDConfig(function="rosenbrock", optimizer="adam", learning_rate=0.05, iterations=3000, start_x=-1.5, start_y=2))
    assert r["final"]["loss"] < 0.01


def test_nn_solves_xor_and_is_deterministic():
    cfg = nn.NNConfig(dataset="xor", hidden_layers=[8], activation="tanh", epochs=400, learning_rate=0.05, seed=3)
    r1, r2 = nn.run(cfg), nn.run(cfg)
    assert r1["final"]["train_acc"] >= 0.9
    assert r1["history"] == r2["history"]


def test_nn_backprop_matches_numerical_gradient():
    rng = np.random.default_rng(0)
    X, y = rng.normal(size=(10, 2)), (rng.random((10, 1)) > 0.5).astype(float)
    net = nn.MLP([2, 3, 1], "tanh", "xavier", rng)
    zs, acts = net.forward(X)
    gW, _ = net.backward(zs, acts, y, 0.0)
    h, i, j = 1e-6, 1, 2
    net.W[0][i, j] += h
    lp = nn._bce(net.forward(X)[1][-1], y)
    net.W[0][i, j] -= 2 * h
    lm = nn._bce(net.forward(X)[1][-1], y)
    assert gW[0][i, j] == pytest.approx((lp - lm) / (2 * h), abs=1e-7)


def test_nn_without_hidden_layer_cannot_learn_circles():
    r = nn.run(nn.NNConfig(dataset="circles", hidden_layers=[], epochs=300))
    assert r["final"]["train_acc"] < 0.75
    assert any("No hidden layer" in d for d in r["diagnostics"])


def test_nn_zero_init_symmetry_diagnosed():
    r = nn.run(nn.NNConfig(dataset="circles", hidden_layers=[8], init="zeros", epochs=50))
    assert any("Symmetry" in d for d in r["diagnostics"])


def test_nn_huge_lr_diverges_or_breaks():
    r = nn.run(nn.NNConfig(dataset="moons", hidden_layers=[16, 16], activation="relu", init="large",
                           optimizer="sgd", learning_rate=20, epochs=100))
    assert r["status"] == "diverged" or any("Dead ReLU" in d or "Underfitting" in d for d in r["diagnostics"])


def test_ml_lab_metrics_consistent():
    r = ml_lab.run(ml_lab.MLConfig(dataset="iris", model="logistic_regression"))
    cm = np.array(r["confusion_matrix"])
    assert cm.sum() == r["n_test"] and r["test_accuracy"] == pytest.approx(np.trace(cm) / cm.sum(), abs=1e-4)
    assert r["test_accuracy"] > 0.85


def test_ml_lab_overfitting_detected_with_label_noise():
    r = ml_lab.run(ml_lab.MLConfig(dataset="wine", model="decision_tree", label_noise=0.3, max_depth=None))
    assert r["train_accuracy"] == 1.0 and r["test_accuracy"] < 0.9
    assert any("Overfitting" in n for n in r["notes"]) and r["labels_flipped"] > 0


class Ctx:
    def __init__(self, catalog):
        self.catalog = catalog


def test_rag_retrieves_and_evaluates(catalog):
    r = rag.run(rag.RAGConfig(query="stability limit of the learning rate"), Ctx(catalog))
    assert r["results"][0]["doc_id"] == "ml.gradient_descent"
    assert "learning" in r["results"][0]["matched_terms"]
    assert r["evaluation"]["recall_at_k"] >= 0.75 and 0 < r["evaluation"]["mrr"] <= 1


def test_rag_breaking_with_tiny_chunks_hurts_or_warns(catalog):
    good = rag.run(rag.RAGConfig(chunk_size=80, overlap=20), Ctx(catalog))["evaluation"]["mrr"]
    bad = rag.run(rag.RAGConfig(chunk_size=5, overlap=0, top_k=5), Ctx(catalog))
    assert any("small chunks" in n for n in bad["notes"])
    assert bad["evaluation"]["mrr"] <= good + 1e-9


def test_rag_validation():
    with pytest.raises(ValueError):
        rag.run(rag.RAGConfig(chunk_size=10, overlap=10, corpus="custom", documents=[{"id": "a", "text": "x"}]))


def test_transformer_attention_properties():
    r = transformer.run(transformer.TransformerConfig(positional=False))
    for sums in r["row_sums"]:
        assert np.allclose(sums, 1.0)
    assert r["permutation_test"]["max_output_difference_after_unshuffling"] < 1e-9
    r2 = transformer.run(transformer.TransformerConfig(positional=True))
    assert r2["permutation_test"]["max_output_difference_after_unshuffling"] > 1e-3


def test_transformer_causal_mask_is_lower_triangular():
    r = transformer.run(transformer.TransformerConfig(causal_mask=True, n_heads=1))
    A = np.array(r["attention"][0])
    assert np.allclose(np.triu(A, 1), 0)


def test_infrastructure_estimates_are_arithmetic():
    e = infra.estimate(infra.InfraConfig(params_billion=7, precision="fp16"))
    assert e["memory_gb"]["weights"] == pytest.approx(14.0)
    e4 = infra.estimate(infra.InfraConfig(params_billion=7, precision="int4"))
    assert e4["memory_gb"]["weights"] == pytest.approx(3.5)
    big = infra.estimate(infra.InfraConfig(params_billion=70, precision="fp16", hardware="consumer_gpu_8gb"))
    assert not big["fits"] and big["kind"] == "estimate"


def test_infrastructure_measurement_is_real():
    m = infra.benchmark(size=128, repeats=2)
    assert m["kind"] == "measurement" and m["results"]["float64"]["gflops"] > 0


def test_simulation_api_saves_reproducible_experiment(client, student):
    cfg = {"function": "quadratic", "learning_rate": 1.2, "iterations": 300}
    r = client.post(f"/api/v1/students/{student}/simulations/gradient_descent/run", json={"config": cfg}).json()
    assert r["result"]["status"] == "diverged" and r["experiment_id"]
    assert any(a["code"] == "breaker" for a in r["achievements"])
    exp = client.get(f"/api/v1/students/{student}/experiments").json()[0]
    rerun = client.post(f"/api/v1/students/{student}/simulations/gradient_descent/run",
                        json={"config": exp["config"], "save": False}).json()
    assert rerun["result"]["final"] == r["result"]["final"]


def test_simulation_api_validates_config(client, student):
    r = client.post(f"/api/v1/students/{student}/simulations/gradient_descent/run", json={"config": {"learning_rate": -1}})
    assert r.status_code == 422
    assert client.post(f"/api/v1/students/{student}/simulations/nope/run", json={}).status_code == 404
