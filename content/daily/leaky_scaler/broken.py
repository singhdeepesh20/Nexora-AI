import numpy as np


def split_then_scale(X, test_fraction=0.25):
    """Split rows (last rows are test), then standardise with TRAIN statistics only."""
    X = np.asarray(X, dtype=float)
    n_test = int(len(X) * test_fraction)
    mean, std = X.mean(axis=0), X.std(axis=0)
    X_train, X_test = X[:-n_test], X[-n_test:]
    return (X_train - mean) / std, (X_test - mean) / std, mean, std
