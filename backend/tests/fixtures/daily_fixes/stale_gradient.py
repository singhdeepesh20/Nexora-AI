import numpy as np


def train(X, y, lr=0.05, steps=300, batch=4):
    """Mini-batch gradient descent with the gradient reset every step."""
    X, y = np.asarray(X, float), np.asarray(y, float)
    w = np.zeros(X.shape[1])
    for step in range(steps):
        i = (step * batch) % len(X)
        xb, yb = X[i:i + batch], y[i:i + batch]
        grad = 2 * xb.T @ (xb @ w - yb) / len(xb)
        w -= lr * grad
    return w
