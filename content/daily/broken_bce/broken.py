import numpy as np


def binary_cross_entropy(p, y):
    """Mean binary cross-entropy. p: predicted P(y=1), y: labels in {0, 1}."""
    p = np.clip(np.asarray(p, float), 1e-12, 1 - 1e-12)
    y = np.asarray(y, float)
    return float(-np.mean(y * np.log(p)))
