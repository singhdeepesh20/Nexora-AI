def chunk_words(words, size, overlap):
    """Chunks sharing `overlap` words."""
    if size < 1 or not 0 <= overlap < size:
        raise ValueError("invalid size/overlap")
    chunks = []
    for start in range(0, len(words), size - overlap):
        chunks.append(words[start:start + size])
        if start + size >= len(words):
            break
    return chunks
