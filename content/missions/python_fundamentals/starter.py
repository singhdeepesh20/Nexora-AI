"""Mission: Python Fundamentals. Implement the three functions below."""


def word_frequencies(text: str) -> dict[str, int]:
    """Count lowercase words. Any non-letter character separates words."""
    raise NotImplementedError


def top_k(freqs: dict[str, int], k: int) -> list[tuple[str, int]]:
    """Return the k most frequent (word, count) pairs; ties are broken alphabetically."""
    raise NotImplementedError


def normalize(values: list[float]) -> list[float]:
    """Min-max scale values into [0, 1]. Constant input -> all 0.0. Empty -> []."""
    raise NotImplementedError
