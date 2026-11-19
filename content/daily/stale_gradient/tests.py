import numpy as np
from solution import train

rng = np.random.default_rng(0)
X = rng.normal(size=(40, 3))
w_true = np.array([1.5, -2.0, 0.5])
y = X @ w_true


def test_converges_to_true_weights():
    assert np.allclose(train(X, y), w_true, atol=1e-2)


def test_finite():
    assert np.all(np.isfinite(train(X, y)))
