import math
from solution import parse_prediction


def test_valid_payload():
    assert parse_prediction({"label": "dog", "confidence": 0.87}) == ("dog", 0.87)


def rejects(payload):
    try:
        parse_prediction(payload)
    except ValueError:
        return True
    return False


def test_rejects_unknown_label():
    assert rejects({"label": "car", "confidence": 0.5})


def test_rejects_out_of_range_confidence():
    assert rejects({"label": "cat", "confidence": 1.7}) and rejects({"label": "cat", "confidence": -0.1})


def test_rejects_missing_or_wrong_types():
    assert rejects({"label": "cat"}) and rejects({"confidence": 0.3}) and rejects({"label": "cat", "confidence": "high"})
    assert rejects({"label": "cat", "confidence": math.nan})
