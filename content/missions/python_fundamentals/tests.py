from solution import normalize, top_k, word_frequencies


def test_correct_counts():
    assert word_frequencies("the cat and the hat") == {"the": 2, "cat": 1, "and": 1, "hat": 1}


def test_correct_case_and_punctuation():
    assert word_frequencies("Data, data! DATA? model-data") == {"data": 4, "model": 1}


def test_correct_top_k_order():
    freqs = {"b": 3, "a": 3, "c": 5, "d": 1}
    assert top_k(freqs, 3) == [("c", 5), ("a", 3), ("b", 3)]


def test_correct_normalize():
    assert normalize([2, 4, 6]) == [0.0, 0.5, 1.0]


def test_edge_empty_text():
    assert word_frequencies("") == {}
    assert word_frequencies("123 !!! ...") == {}


def test_edge_top_k_larger_than_vocab():
    assert top_k({"x": 1}, 10) == [("x", 1)]


def test_edge_normalize_constant_and_empty():
    assert normalize([7, 7, 7]) == [0.0, 0.0, 0.0]
    assert normalize([]) == []


def test_edge_normalize_does_not_mutate():
    data = [3, 1, 2]
    normalize(data)
    assert data == [3, 1, 2]


def test_perf_large_text():
    text = "alpha beta gamma delta " * 50000
    freqs = word_frequencies(text)
    assert freqs["alpha"] == 50000
    assert top_k(freqs, 1)[0][1] == 50000
