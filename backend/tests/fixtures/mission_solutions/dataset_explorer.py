import math


def _mean(xs):
    """Mean or None."""
    return sum(xs) / len(xs) if xs else None


def column_stats(rows, column):
    """Descriptive statistics ignoring None."""
    vals = [r.get(column) for r in rows]
    present = sorted(v for v in vals if v is not None)
    n = len(present)
    mean = _mean(present)
    if n == 0:
        median = std = None
    else:
        mid = n // 2
        median = present[mid] if n % 2 else (present[mid - 1] + present[mid]) / 2
        std = math.sqrt(sum((v - mean) ** 2 for v in present) / n)
    return {"count": n, "missing": len(vals) - n, "mean": mean, "median": median, "std": std}


def group_mean(rows, by, column):
    """Per-group mean."""
    groups = {}
    for r in rows:
        groups.setdefault(r[by], [])
        if r.get(column) is not None:
            groups[r[by]].append(r[column])
    return {g: _mean(v) for g, v in groups.items()}
