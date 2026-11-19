CLASSES = {"cat", "dog", "bird"}


def parse_prediction(payload):
    """Return (label, confidence) from {"label": str, "confidence": float}; raise ValueError if invalid."""
    return payload.get("label"), payload.get("confidence")
