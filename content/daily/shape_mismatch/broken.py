import numpy as np


def dense_forward(X, W, b):
    """Dense layer with ReLU. X: (n, inputs), W: (inputs, outputs), b: (outputs,)."""
    Z = W @ X + b
    return np.maximum(0, Z)
