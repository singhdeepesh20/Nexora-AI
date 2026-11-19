from solution import chunk_words

W = [f"w{i}" for i in range(10)]


def test_overlap_is_shared():
    c = chunk_words(W, 4, 1)
    assert c[0] == ["w0", "w1", "w2", "w3"] and c[1][0] == "w3"


def test_every_word_is_covered():
    covered = {w for c in chunk_words(W, 4, 2) for w in c}
    assert covered == set(W)


def test_no_overlap_case():
    assert chunk_words(W, 5, 0) == [W[:5], W[5:]]
