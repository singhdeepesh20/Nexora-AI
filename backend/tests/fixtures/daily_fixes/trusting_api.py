import math

CLASSES = {"cat", "dog", "bird"}


def parse_prediction(payload):
    """Validate and return (label, confidence)."""
    if not isinstance(payload, dict):
        raise ValueError("payload must be an object")
    label, conf = payload.get("label"), payload.get("confidence")
    if label not in CLASSES:
        raise ValueError("unknown label")
    if isinstance(conf, bool) or not isinstance(conf, (int, float)) or not math.isfinite(conf) or not 0 <= conf <= 1:
        raise ValueError("confidence must be a number in [0, 1]")
    return label, float(conf)
