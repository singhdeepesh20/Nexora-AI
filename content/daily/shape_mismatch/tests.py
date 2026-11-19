import numpy as np
from solution import dense_forward


def test_output_shape():
    assert dense_forward(np.ones((5, 3)), np.ones((3, 2)), np.zeros(2)).shape == (5, 2)


def test_values():
    X = np.array([[1., 2.], [3., -4.]])
    W = np.array([[1., -1., 0.], [0.5, 1., 2.]])
    b = np.array([0., 0.5, -1.])
    assert np.allclose(dense_forward(X, W, b), np.maximum(0, X @ W + b))


def test_square_case_is_not_transposed():
    X = np.array([[1., 0.], [0., 0.]])
    W = np.array([[0., 1.], [0., 0.]])
    assert np.allclose(dense_forward(X, W, np.zeros(2)), [[0., 1.], [0., 0.]])
