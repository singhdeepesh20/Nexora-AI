import numpy as np


def sigmoid(z):
    """Stable sigmoid."""
    z = np.asarray(z, dtype=float)
    out = np.empty_like(z)
    pos = z >= 0
    out[pos] = 1.0 / (1.0 + np.exp(-z[pos]))
    ez = np.exp(z[~pos])
    out[~pos] = ez / (1.0 + ez)
    return out


def predict_proba(X, w, b):
    """P(y=1)."""
    return sigmoid(X @ w + b)


def gradients(X, y, w, b):
    """BCE gradients."""
    err = predict_proba(X, w, b) - y
    return X.T @ err / len(y), float(err.mean())


def train(X, y, lr=0.1, epochs=1000):
    """Batch gradient descent."""
    w, b = np.zeros(X.shape[1]), 0.0
    for _ in range(epochs):
        dw, db = gradients(X, y, w, b)
        w = w - lr * dw
        b -= lr * db
    return w, b
