import numpy as np


def split_then_scale(X, test_fraction=0.25):
    """Split, then standardise with training statistics only."""
    X = np.asarray(X, dtype=float)
    n_test = int(len(X) * test_fraction)
    X_train, X_test = X[:-n_test], X[-n_test:]
    mean, std = X_train.mean(axis=0), X_train.std(axis=0)
    return (X_train - mean) / std, (X_test - mean) / std, mean, std
