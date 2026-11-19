import numpy as np


def dense_forward(X, W, b):
    """Dense layer with ReLU."""
    return np.maximum(0, X @ W + b)
