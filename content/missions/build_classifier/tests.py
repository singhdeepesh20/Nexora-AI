import time
import warnings

import numpy as np
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split

from solution import gradients, predict_proba, sigmoid, train


def bce(X, y, w, b):
    p = np.clip(predict_proba(X, w, b), 1e-12, 1 - 1e-12)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def data():
    X, y = load_breast_cancer(return_X_y=True)
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)
    mu, sd = Xtr.mean(0), Xtr.std(0)
    return (Xtr - mu) / sd, (Xte - mu) / sd, ytr.astype(float), yte.astype(float)


def test_correct_sigmoid_values():
    assert np.allclose(sigmoid(np.array([0.0, 2.0, -2.0])), [0.5, 0.880797, 0.119203], atol=1e-6)


def test_correct_predict_proba_shape():
    X = np.ones((5, 3))
    p = predict_proba(X, np.zeros(3), 0.0)
    assert p.shape == (5,) and np.allclose(p, 0.5)


def test_correct_gradient_check():
    rng = np.random.default_rng(0)
    X, y = rng.normal(size=(20, 4)), (rng.random(20) > 0.5).astype(float)
    w, b, h = rng.normal(size=4), 0.3, 1e-6
    dw, db = gradients(X, y, w, b)
    num = np.array([(bce(X, y, w + h * e, b) - bce(X, y, w - h * e, b)) / (2 * h) for e in np.eye(4)])
    assert np.allclose(dw, num, atol=1e-5), f"dw={dw} numeric={num}"
    assert abs(db - (bce(X, y, w, b + h) - bce(X, y, w, b - h)) / (2 * h)) < 1e-5


def test_correct_test_accuracy():
    Xtr, Xte, ytr, yte = data()
    w, b = train(Xtr, ytr, lr=0.1, epochs=1000)
    acc = float(np.mean((predict_proba(Xte, w, b) >= 0.5) == yte))
    assert acc >= 0.93, f"test accuracy {acc:.3f} < 0.93"


def test_edge_sigmoid_extremes_are_stable():
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        out = sigmoid(np.array([-1000.0, 1000.0]))
    assert np.all(np.isfinite(out)) and out[0] < 1e-12 and out[1] > 1 - 1e-12


def test_edge_training_does_not_mutate_input():
    Xtr, _, ytr, _ = data()
    before = Xtr.copy()
    train(Xtr, ytr, lr=0.1, epochs=5)
    assert np.array_equal(before, Xtr)


def test_perf_training_speed():
    Xtr, _, ytr, _ = data()
    t0 = time.perf_counter()
    train(Xtr, ytr, lr=0.1, epochs=1000)
    assert time.perf_counter() - t0 < 3.0, "training should be vectorised"
