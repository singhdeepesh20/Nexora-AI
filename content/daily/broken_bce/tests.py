import math
import numpy as np
from solution import binary_cross_entropy


def test_balanced_half():
    assert abs(binary_cross_entropy([0.5, 0.5], [1, 0]) - math.log(2)) < 1e-9


def test_negative_examples_are_penalised():
    assert binary_cross_entropy([0.99], [0]) > 4.0


def test_matches_formula():
    p, y = np.array([0.9, 0.2, 0.7]), np.array([1, 0, 0])
    expected = -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))
    assert abs(binary_cross_entropy(p, y) - expected) < 1e-9


def test_extremes_are_finite():
    assert math.isfinite(binary_cross_entropy([0.0, 1.0], [1, 0]))
