import numpy as np


def fit_slope(x, y, lr=0.05, epochs=200):
    """Gradient descent on MSE for y = w * x."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    w = 0.0
    for _ in range(epochs):
        w -= lr * 2 * np.mean((w * x - y) * x)
    return w
