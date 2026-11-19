import numpy as np
from solution import fit_slope

x = np.array([1., 2., 3., 4., 5., 6.])
y = 2.0 * x


def test_returns_finite_value():
    assert np.isfinite(fit_slope(x, y))


def test_recovers_true_slope():
    assert abs(fit_slope(x, y) - 2.0) < 1e-3


def test_works_with_other_data():
    assert abs(fit_slope(x, -3.0 * x) + 3.0) < 1e-3
