"""Transformer Laboratory - an EXPLANATORY TOY model.

Weights are small and randomly initialised from a seed (untrained). It exists to make every
step of tokenisation -> embeddings -> positional encoding -> multi-head attention inspectable.
It is not a production transformer and does not produce meaningful language predictions.
"""

from __future__ import annotations

import re

import numpy as np
from pydantic import BaseModel, Field, model_validator

VERSION = "1.0"


class TransformerConfig(BaseModel):
    text: str = Field("the model reads the whole sentence at once", min_length=1, max_length=300)
    d_model: int = Field(16, ge=4, le=64)
    n_heads: int = Field(2, ge=1, le=8)
    positional: bool = True
    causal_mask: bool = False
    seed: int = Field(0, ge=0, le=2**31 - 1)

    @model_validator(mode="after")
    def _check(self):
        if self.d_model % self.n_heads:
            raise ValueError("d_model must be divisible by n_heads")
        return self


def positional_encoding(n: int, d: int) -> np.ndarray:
    pos = np.arange(n)[:, None]
    i = np.arange(d)[None, :]
    angle = pos / np.power(10000, (2 * (i // 2)) / d)
    return np.where(i % 2 == 0, np.sin(angle), np.cos(angle))


def softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - x.max(-1, keepdims=True))
    return e / e.sum(-1, keepdims=True)


def _attend(E: np.ndarray, Wq, Wk, Wv, Wo, n_heads: int, causal: bool):
    n, d = E.shape
    dh = d // n_heads
    Q, K, V = E @ Wq, E @ Wk, E @ Wv
    heads, outs = [], []
    for h in range(n_heads):
        sl = slice(h * dh, (h + 1) * dh)
        scores = Q[:, sl] @ K[:, sl].T / np.sqrt(dh)
        if causal:
            scores = np.where(np.tril(np.ones((n, n))) == 1, scores, -np.inf)
        A = softmax(scores)
        heads.append(A)
        outs.append(A @ V[:, sl])
    return heads, np.concatenate(outs, axis=1) @ Wo


def run(cfg: TransformerConfig, ctx=None) -> dict:
    tokens = re.findall(r"\w+|[^\w\s]", cfg.text.lower())[:24]
    if not tokens:
        raise ValueError("text contains no tokens")
    vocab: dict[str, int] = {}
    ids = [vocab.setdefault(t, len(vocab)) for t in tokens]
    rng = np.random.default_rng(cfg.seed)
    d = cfg.d_model
    emb_table = rng.normal(0, 1, (len(vocab), d))
    Wq, Wk, Wv, Wo = (rng.normal(0, 1 / np.sqrt(d), (d, d)) for _ in range(4))
    E = emb_table[ids]
    P = positional_encoding(len(tokens), d)
    X = E + P if cfg.positional else E
    heads, out = _attend(X, Wq, Wk, Wv, Wo, cfg.n_heads, cfg.causal_mask)

    # Permutation experiment: reverse the tokens and compare outputs, un-reversing the result.
    perm = np.arange(len(tokens))[::-1]
    Xp = (E[perm] + P) if cfg.positional else E[perm]
    _, out_p = _attend(Xp, Wq, Wk, Wv, Wo, cfg.n_heads, False)
    _, out_np = _attend(X, Wq, Wk, Wv, Wo, cfg.n_heads, False)
    diff = float(np.max(np.abs(out_p[np.argsort(perm)] - out_np)))
    return {
        "disclaimer": "Toy model with untrained random weights - for understanding the mechanics only.",
        "tokens": tokens, "token_ids": ids, "vocab_size": len(vocab),
        "embeddings": np.round(E, 3).tolist(), "positional": np.round(P, 3).tolist(),
        "attention": [np.round(np.nan_to_num(A), 4).tolist() for A in heads],
        "row_sums": [np.round(A.sum(1), 6).tolist() for A in heads],
        "output_norms": np.round(np.linalg.norm(out, axis=1), 4).tolist(),
        "permutation_test": {
            "max_output_difference_after_unshuffling": round(diff, 8),
            "explanation": ("Without positional encoding, reversing the sentence just reverses the outputs (difference "
                            "~0): attention cannot see word order." if not cfg.positional else
                            "With positional encoding, reversing the sentence changes the outputs: word order now "
                            "matters."),
        },
    }
