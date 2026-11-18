import numpy as np


def init_params(n_in, n_hidden, n_out, seed=0):
    """Random init."""
    rng = np.random.default_rng(seed)
    return {"W1": rng.normal(0, 1, (n_in, n_hidden)), "b1": np.zeros(n_hidden),
            "W2": rng.normal(0, 1, (n_hidden, n_out)), "b2": np.zeros(n_out)}


def forward(params, X):
    """Forward pass."""
    h = np.tanh(X @ params["W1"] + params["b1"])
    p = 1 / (1 + np.exp(-(h @ params["W2"] + params["b2"])))
    return p, {"X": X, "h": h, "p": p}


def backward(params, cache, y):
    """Backward pass."""
    n = y.shape[0]
    dz2 = (cache["p"] - y) / n
    dh = dz2 @ params["W2"].T
    dz1 = dh * (1 - cache["h"] ** 2)
    return {"W2": cache["h"].T @ dz2, "b2": dz2.sum(0), "W1": cache["X"].T @ dz1, "b1": dz1.sum(0)}


def train(X, y, n_hidden=4, lr=0.5, epochs=5000, seed=0):
    """Train."""
    params = init_params(X.shape[1], n_hidden, y.shape[1], seed)
    for _ in range(epochs):
        _, cache = forward(params, X)
        grads = backward(params, cache, y)
        for k in params:
            params[k] -= lr * grads[k]
    return params
