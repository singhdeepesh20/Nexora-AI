import numpy as np
from solution import split_then_scale

X = np.arange(40, dtype=float).reshape(20, 2) ** 1.5


def test_statistics_come_from_training_rows():
    _, _, mean, std = split_then_scale(X, 0.25)
    assert np.allclose(mean, X[:15].mean(axis=0)) and np.allclose(std, X[:15].std(axis=0))


def test_training_split_is_standardised():
    tr, _, _, _ = split_then_scale(X, 0.25)
    assert np.allclose(tr.mean(axis=0), 0) and np.allclose(tr.std(axis=0), 1)


def test_test_split_uses_training_statistics():
    tr, te, mean, std = split_then_scale(X, 0.25)
    assert te.shape == (5, 2) and np.allclose(te, (X[15:] - mean) / std)
