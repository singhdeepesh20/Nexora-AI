import numpy as np


def fit_slope(x, y, lr=0.5, epochs=200):
    """Gradient descent on mean squared error for y = w * x. Returns w."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    w = 0.0
    for _ in range(epochs):
        grad = 2 * np.mean((w * x - y) * x)
        w -= lr * grad
    return w
