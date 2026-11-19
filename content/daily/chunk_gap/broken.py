def chunk_words(words, size, overlap):
    """Chunks of `size` words; consecutive chunks share `overlap` words."""
    if size < 1 or not 0 <= overlap < size:
        raise ValueError("invalid size/overlap")
    chunks = []
    step = size + overlap
    for start in range(0, len(words), step):
        chunks.append(words[start:start + size])
        if start + size >= len(words):
            break
    return chunks
