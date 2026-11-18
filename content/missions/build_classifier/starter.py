"""Mission: Build a Classifier - logistic regression from scratch with NumPy."""

import numpy as np


def sigmoid(z: np.ndarray) -> np.ndarray:
    """Numerically stable sigmoid."""
    raise NotImplementedError


def predict_proba(X: np.ndarray, w: np.ndarray, b: float) -> np.ndarray:
    """Probability of class 1 for each row of X."""
    raise NotImplementedError


def gradients(X: np.ndarray, y: np.ndarray, w: np.ndarray, b: float) -> tuple[np.ndarray, float]:
    """Gradients (dw, db) of the mean binary cross-entropy."""
    raise NotImplementedError


def train(X: np.ndarray, y: np.ndarray, lr: float = 0.1, epochs: int = 1000) -> tuple[np.ndarray, float]:
    """Batch gradient descent starting from zeros. Returns (w, b)."""
    raise NotImplementedError
