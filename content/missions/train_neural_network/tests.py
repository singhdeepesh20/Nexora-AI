import time

import numpy as np

from solution import backward, forward, init_params, train

X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=float)
Y = np.array([[0], [1], [1], [0]], dtype=float)


def loss(params, X, y):
    p, _ = forward(params, X)
    p = np.clip(p, 1e-12, 1 - 1e-12)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def test_correct_shapes():
    p = init_params(2, 5, 1, seed=1)
    assert p["W1"].shape == (2, 5) and p["b1"].shape == (5,)
    assert p["W2"].shape == (5, 1) and p["b2"].shape == (1,)
    probs, _ = forward(p, X)
    assert probs.shape == (4, 1) and np.all((probs > 0) & (probs < 1))


def test_correct_gradient_check():
    params = init_params(2, 3, 1, seed=3)
    _, cache = forward(params, X)
    grads = backward(params, cache, Y)
    h = 1e-6
    for key in ("W1", "b1", "W2", "b2"):
        num = np.zeros_like(params[key])
        it = np.nditer(params[key], flags=["multi_index"])
        for _ in it:
            i = it.multi_index
            old = params[key][i]
            params[key][i] = old + h
            lp = loss(params, X, Y)
            params[key][i] = old - h
            lm = loss(params, X, Y)
            params[key][i] = old
            num[i] = (lp - lm) / (2 * h)
        assert np.allclose(grads[key], num, atol=1e-6), f"gradient mismatch for {key}"


def test_correct_solves_xor():
    # Gradient descent can land in a poor local minimum for an unlucky seed, so a correct
    # implementation must solve XOR for at least 2 of 3 seeds.
    solved = 0
    for seed in (0, 1, 2):
        params = train(X, Y, n_hidden=8, lr=0.5, epochs=5000, seed=seed)
        probs, _ = forward(params, X)
        solved += bool(np.array_equal((probs >= 0.5).astype(float), Y))
    assert solved >= 2, f"XOR solved for only {solved} of 3 seeds"


def test_edge_loss_decreases():
    params = init_params(2, 4, 1, seed=0)
    before = loss(params, X, Y)
    trained = train(X, Y, n_hidden=4, lr=0.5, epochs=500, seed=0)
    assert loss(trained, X, Y) < before


def test_edge_deterministic_seed():
    a, b = init_params(2, 4, 1, seed=7), init_params(2, 4, 1, seed=7)
    assert all(np.array_equal(a[k], b[k]) for k in a)


def test_perf_training_speed():
    t0 = time.perf_counter()
    train(X, Y, n_hidden=8, lr=0.5, epochs=5000, seed=0)
    assert time.perf_counter() - t0 < 3.0
