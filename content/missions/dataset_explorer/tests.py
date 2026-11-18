import copy
import math

from solution import column_stats, group_mean

ROWS = [
    {"city": "Pune", "temp": 31.0, "rain": 2.0},
    {"city": "Pune", "temp": 29.0, "rain": None},
    {"city": "Oslo", "temp": 4.0, "rain": 10.0},
    {"city": "Oslo", "temp": None, "rain": 12.0},
    {"city": "Lima", "temp": 20.0, "rain": None},
]


def close(a, b):
    return a is not None and math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-9)


def test_correct_count_and_missing():
    s = column_stats(ROWS, "temp")
    assert s["count"] == 4 and s["missing"] == 1


def test_correct_mean_median():
    s = column_stats(ROWS, "temp")
    assert close(s["mean"], 21.0)
    assert close(s["median"], 24.5)


def test_correct_std_population():
    s = column_stats([{"v": x} for x in [2, 4, 4, 4, 5, 5, 7, 9]], "v")
    assert close(s["std"], 2.0)


def test_correct_group_mean():
    g = group_mean(ROWS, "city", "temp")
    assert close(g["Pune"], 30.0) and close(g["Oslo"], 4.0) and close(g["Lima"], 20.0)


def test_edge_all_missing():
    s = column_stats([{"v": None}, {"v": None}], "v")
    assert s["count"] == 0 and s["missing"] == 2
    assert s["mean"] is None and s["median"] is None and s["std"] is None


def test_edge_group_all_missing():
    g = group_mean(ROWS, "city", "rain")
    assert g["Lima"] is None and close(g["Oslo"], 11.0)


def test_edge_odd_median_and_no_mutation():
    rows = copy.deepcopy(ROWS)
    s = column_stats(rows, "rain")
    assert close(s["median"], 10.0)
    assert rows == ROWS


def test_perf_large_dataset():
    rows = [{"g": i % 10, "v": float(i)} for i in range(200000)]
    s = column_stats(rows, "v")
    assert s["count"] == 200000
    assert len(group_mean(rows, "g", "v")) == 10
