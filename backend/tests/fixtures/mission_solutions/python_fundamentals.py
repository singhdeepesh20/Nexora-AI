import re


def word_frequencies(text):
    """Count lowercase words."""
    freqs = {}
    for word in re.findall(r"[a-z]+", text.lower()):
        freqs[word] = freqs.get(word, 0) + 1
    return freqs


def top_k(freqs, k):
    """Most frequent words, ties alphabetical."""
    return sorted(freqs.items(), key=lambda kv: (-kv[1], kv[0]))[:k]


def normalize(values):
    """Min-max scale."""
    if not values:
        return []
    lo, hi = min(values), max(values)
    if hi == lo:
        return [0.0 for _ in values]
    return [(v - lo) / (hi - lo) for v in values]
