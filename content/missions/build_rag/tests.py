import time

from solution import TfidfIndex, chunk_text, tokenize

CORPUS = {
    "gd": "Gradient descent updates parameters against the gradient. The learning rate controls the step size.",
    "attn": "Attention computes softmax of query key dot products and mixes the values.",
    "f1": "Precision recall and the F1 score evaluate classifiers on imbalanced data.",
    "relu": "The ReLU activation outputs max of zero and its input; dead ReLU units stop learning.",
    "bayes": "Bayes theorem combines a prior base rate with the likelihood of the evidence.",
}


def build():
    idx = TfidfIndex()
    for k, v in CORPUS.items():
        idx.add(k, v)
    return idx


def test_correct_chunking():
    words = " ".join(f"w{i}" for i in range(10))
    chunks = chunk_text(words, chunk_size=4, overlap=1)
    assert chunks[0] == "w0 w1 w2 w3" and chunks[1] == "w3 w4 w5 w6"
    assert chunks[-1].split()[-1] == "w9"


def test_correct_tokenize():
    assert tokenize("Hello, RAG-2 World!") == ["hello", "rag", "2", "world"]


def test_correct_retrieval_top1():
    idx = build()
    cases = {"how does the learning rate affect gradient steps": "gd",
             "softmax over query and key": "attn",
             "imbalanced classifier precision": "f1",
             "prior and likelihood": "bayes"}
    for q, expected in cases.items():
        assert idx.search(q, k=1)[0][0] == expected, q


def test_correct_scores_sorted_and_bounded():
    res = build().search("the gradient and the attention", k=5)
    scores = [s for _, s in res]
    assert scores == sorted(scores, reverse=True)
    assert all(0 < s <= 1.0 + 1e-9 for s in scores)


def test_edge_invalid_overlap():
    for size, ov in ((3, 3), (0, 0), (2, 5)):
        try:
            chunk_text("a b c d", size, ov)
        except ValueError:
            continue
        raise AssertionError(f"expected ValueError for size={size}, overlap={ov}")


def test_edge_no_match_and_empty():
    idx = build()
    assert idx.search("zebra quantum", k=3) == []
    assert chunk_text("", 3, 1) == []


def test_perf_index_and_search():
    idx = TfidfIndex()
    for i in range(2000):
        idx.add(f"d{i}", f"document {i} about topic{i % 37} and subject{i % 11} with filler words")
    idx.add("target", "unique needle phrase about transformers")
    t0 = time.perf_counter()
    res = idx.search("needle transformers", k=5)
    assert time.perf_counter() - t0 < 1.0
    assert res[0][0] == "target"
