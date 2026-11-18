import math
import re
from collections import Counter


def chunk_text(text, chunk_size, overlap):
    """Word chunks with overlap."""
    if chunk_size < 1 or overlap < 0 or overlap >= chunk_size:
        raise ValueError("require chunk_size >= 1 and 0 <= overlap < chunk_size")
    words = text.split()
    chunks, step = [], chunk_size - overlap
    for start in range(0, len(words), step):
        chunks.append(" ".join(words[start:start + chunk_size]))
        if start + chunk_size >= len(words):
            break
    return chunks


def tokenize(text):
    """Lowercase alphanumeric tokens."""
    return re.findall(r"[a-z0-9]+", text.lower())


class TfidfIndex:
    """TF-IDF cosine index."""

    def __init__(self):
        self.docs = {}
        self.df = Counter()
        self.postings = {}

    def add(self, doc_id, text):
        """Index a document."""
        tf = Counter(tokenize(text))
        self.docs[doc_id] = tf
        for t in tf:
            self.df[t] += 1
            self.postings.setdefault(t, set()).add(doc_id)
        self._norms = None

    def _idf(self, t):
        """Smoothed idf."""
        return math.log((1 + len(self.docs)) / (1 + self.df[t])) + 1

    def search(self, query, k=3):
        """Cosine top-k."""
        if self._norms is None:
            self._norms = {d: math.sqrt(sum((c * self._idf(t)) ** 2 for t, c in tf.items())) or 1.0
                           for d, tf in self.docs.items()}
        q = {t: c * self._idf(t) for t, c in Counter(tokenize(query)).items() if t in self.df}
        qn = math.sqrt(sum(v * v for v in q.values()))
        if not q:
            return []
        scores = Counter()
        for t, qw in q.items():
            for d in self.postings[t]:
                scores[d] += qw * self.docs[d][t] * self._idf(t)
        res = [(d, s / (qn * self._norms[d])) for d, s in scores.items() if s > 0]
        return sorted(res, key=lambda x: (-x[1], x[0]))[:k]
