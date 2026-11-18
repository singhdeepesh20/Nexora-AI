"""RAG Retrieval Laboratory - chunking, BM25 lexical indexing, retrieval and evaluation.

Works with no embedding model at all (lexical BM25). The default corpus is the NEXORA
curriculum itself, with a labelled evaluation set so retrieval quality is measurable.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from typing import Literal

from pydantic import BaseModel, Field

VERSION = "1.0"
STOPWORDS = set("a an and are as at be by for from has in is it its of on or that the to was were with this "
                "you your we our can into than then so if not no do does".split())


class CustomDoc(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=50_000)


class RAGConfig(BaseModel):
    corpus: Literal["curriculum", "custom"] = "curriculum"
    documents: list[CustomDoc] = Field(default_factory=list, max_length=50)
    query: str = Field("why does a large learning rate diverge", min_length=1, max_length=500)
    chunk_size: int = Field(80, ge=5, le=600)
    overlap: int = Field(20, ge=0, le=300)
    top_k: int = Field(5, ge=1, le=20)
    k1: float = Field(1.5, ge=0, le=5)
    b: float = Field(0.75, ge=0, le=1)
    remove_stopwords: bool = True
    evaluate: bool = True


EVAL_SET = [
    ("why does a large learning rate make training diverge", "ml.gradient_descent"),
    ("precision recall and f1 from a confusion matrix", "ml.evaluation"),
    ("softmax of query key dot products scaled by square root", "dl.attention_intro"),
    ("base rate fallacy bayes theorem positive test", "stats.probability"),
    ("dead relu neurons and sigmoid derivative", "dl.neurons_activations"),
    ("chain rule gradient checking finite differences backprop", "dl.forward_backprop"),
    ("cosine similarity of embedding vectors", "math.vectors"),
    ("mean squared error and feature scaling", "ml.linear_regression"),
]


def tokenize(text: str, remove_stopwords: bool) -> list[str]:
    toks = re.findall(r"[a-z0-9]+", text.lower())
    return [t for t in toks if not (remove_stopwords and t in STOPWORDS)]


def chunk(text: str, size: int, overlap: int) -> list[str]:
    words = text.split()
    step = size - overlap
    out = []
    for start in range(0, len(words), step):
        out.append(" ".join(words[start:start + size]))
        if start + size >= len(words):
            break
    return out


class BM25:
    def __init__(self, docs: list[list[str]], k1: float, b: float):
        self.docs, self.k1, self.b = docs, k1, b
        self.tf = [Counter(d) for d in docs]
        self.df = Counter(t for d in self.tf for t in d)
        self.avgdl = sum(len(d) for d in docs) / max(len(docs), 1)
        self.N = len(docs)

    def idf(self, t: str) -> float:
        n = self.df.get(t, 0)
        return math.log(1 + (self.N - n + 0.5) / (n + 0.5))

    def scores(self, q: list[str]) -> list[float]:
        out = []
        for d, tf in zip(self.docs, self.tf, strict=True):
            s = 0.0
            norm = 1 - self.b + self.b * len(d) / (self.avgdl or 1)
            for t in set(q):
                f = tf.get(t, 0)
                if f:
                    s += self.idf(t) * f * (self.k1 + 1) / (f + self.k1 * norm)
            out.append(s)
        return out


def run(cfg: RAGConfig, ctx=None) -> dict:
    if cfg.overlap >= cfg.chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")
    if cfg.corpus == "curriculum":
        if ctx is None or getattr(ctx, "catalog", None) is None:
            raise ValueError("curriculum corpus unavailable")
        docs = {cid: ctx.catalog.lessons[cid] for cid in ctx.catalog.topo_order}
    else:
        if not cfg.documents:
            raise ValueError("provide at least one document for a custom corpus")
        docs = {d.id: d.text for d in cfg.documents}
    chunks: list[tuple[str, str]] = []
    for doc_id, text in docs.items():
        clean = re.sub(r"[#`|>*]+", " ", text)
        for c in chunk(clean, cfg.chunk_size, cfg.overlap):
            chunks.append((doc_id, c))
    toks = [tokenize(c, cfg.remove_stopwords) for _, c in chunks]
    index = BM25(toks, cfg.k1, cfg.b)

    def retrieve(query: str, k: int):
        q = tokenize(query, cfg.remove_stopwords)
        sc = index.scores(q)
        order = sorted(range(len(sc)), key=lambda i: (-sc[i], i))
        return q, [(i, sc[i]) for i in order[:k] if sc[i] > 0]

    qtoks, hits = retrieve(cfg.query, cfg.top_k)
    results = [{"rank": r + 1, "chunk_index": i, "doc_id": chunks[i][0], "score": round(s, 4),
                "matched_terms": sorted(set(qtoks) & set(toks[i])), "text": chunks[i][1][:1200]}
               for r, (i, s) in enumerate(hits)]
    evaluation = None
    if cfg.evaluate and cfg.corpus == "curriculum":
        rows, rr, hit = [], 0.0, 0
        for q, rel in EVAL_SET:
            _, h = retrieve(q, cfg.top_k)
            docs_ranked = [chunks[i][0] for i, _ in h]
            rank = docs_ranked.index(rel) + 1 if rel in docs_ranked else None
            hit += rank is not None
            rr += 1 / rank if rank else 0
            rows.append({"query": q, "relevant": rel, "rank": rank})
        evaluation = {"recall_at_k": round(hit / len(EVAL_SET), 4), "mrr": round(rr / len(EVAL_SET), 4),
                      "k": cfg.top_k, "queries": rows}
    notes = []
    if cfg.chunk_size < 20:
        notes.append("Very small chunks lose context: passages match isolated words but cannot answer questions.")
    if cfg.chunk_size > 300:
        notes.append("Very large chunks dilute relevance: BM25 length normalisation penalises long passages and the "
                     "generator would receive lots of irrelevant text.")
    if not cfg.remove_stopwords:
        notes.append("Stopwords are kept; BM25's IDF down-weights them, but they still add noise to short queries.")
    if cfg.b == 0:
        notes.append("b = 0 disables length normalisation, so long chunks win just by containing more words.")
    if not results:
        notes.append("No chunk shares a term with the query - lexical retrieval cannot match synonyms. Embedding "
                     "retrieval addresses this (optional, requires a local embedding model).")
    return {"retriever": "bm25-lexical", "n_documents": len(docs), "n_chunks": len(chunks),
            "query_terms": qtoks, "results": results, "evaluation": evaluation, "notes": notes}
