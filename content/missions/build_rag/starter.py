"""Mission: Build a RAG Retriever - chunking and a TF-IDF cosine-similarity index."""


def chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    """Split text into chunks of chunk_size words, consecutive chunks sharing `overlap` words."""
    raise NotImplementedError


def tokenize(text: str) -> list[str]:
    """Lowercase alphanumeric tokens."""
    raise NotImplementedError


class TfidfIndex:
    def __init__(self) -> None:
        raise NotImplementedError

    def add(self, doc_id: str, text: str) -> None:
        raise NotImplementedError

    def search(self, query: str, k: int = 3) -> list[tuple[str, float]]:
        """Return up to k (doc_id, cosine score) pairs, best first. Omit zero-score documents."""
        raise NotImplementedError
