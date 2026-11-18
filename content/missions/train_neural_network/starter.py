"""Mission: Train a Neural Network - a two-layer network in NumPy that solves XOR.

Row convention: Z = X @ W + b. Hidden activation tanh, output activation sigmoid,
loss = mean binary cross-entropy.
"""

import numpy as np


def init_params(n_in: int, n_hidden: int, n_out: int, seed: int = 0) -> dict:
    """Return {'W1', 'b1', 'W2', 'b2'} with small random weights and zero biases."""
    raise NotImplementedError


def forward(params: dict, X: np.ndarray) -> tuple[np.ndarray, dict]:
    """Return (probs with shape (n, n_out), cache for backward)."""
    raise NotImplementedError


def backward(params: dict, cache: dict, y: np.ndarray) -> dict:
    """Return gradients {'W1', 'b1', 'W2', 'b2'}; y has shape (n, n_out)."""
    raise NotImplementedError


def train(X, y, n_hidden: int = 4, lr: float = 0.5, epochs: int = 5000, seed: int = 0) -> dict:
    """Full-batch gradient descent. Return trained params."""
    raise NotImplementedError
