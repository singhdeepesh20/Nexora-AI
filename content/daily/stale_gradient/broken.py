import numpy as np


def train(X, y, lr=0.05, steps=300, batch=4):
    """Linear regression y = X @ w by mini-batch gradient descent. Returns w."""
    X, y = np.asarray(X, float), np.asarray(y, float)
    w = np.zeros(X.shape[1])
    grad = np.zeros_like(w)
    for step in range(steps):
        i = (step * batch) % len(X)
        xb, yb = X[i:i + batch], y[i:i + batch]
        grad += 2 * xb.T @ (xb @ w - yb) / len(xb)
        w -= lr * grad
    return w
