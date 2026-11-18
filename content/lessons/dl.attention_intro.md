# Tokens, Embeddings and Attention

Transformers power modern language models. This lesson builds the core mechanism; the *Transformer Laboratory* lets you inspect it on your own sentences.

> The laboratory uses a **toy model** with small, randomly initialised (untrained) weights so every number is inspectable. Production transformers are trained on huge corpora with billions of parameters; the mechanics are the same, the learned patterns are not.

## Tokenisation

Text is split into tokens (words or sub-word pieces) and each token is mapped to an integer ID.

## Embeddings

Each ID indexes a row of an embedding matrix, giving a dense vector. Similar tokens end up with similar vectors after training.

## Positional information

Attention compares every token with every other token and is **permutation-invariant**: shuffling the input would shuffle the output identically. To know word order, transformers add positional encodings (e.g. sinusoids of different frequencies) to embeddings.

## Scaled dot-product attention

```
Attention(Q, K, V) = softmax(Q Kᵀ / √d_k) V
```

- Queries `Q`, keys `K` and values `V` are linear projections of the token vectors.
- Each row of `softmax(...)` is a probability distribution: weights are positive and **sum to 1**.
- Dividing by `√d_k` (8 when `d_k = 64`) keeps dot products from growing with dimension and saturating the softmax.

Worked example: query `[1, 0]`, keys `[1, 0]` and `[0, 1]`, `d_k = 2`. Scores are `0.707` and `0`; softmax gives weights `≈ 0.67` and `0.33`.

## Multi-head attention

Several attention heads run in parallel with different projections, letting the model attend to different relationships at once. Their outputs are concatenated and projected.

## The transformer block

`x → LayerNorm → Multi-head attention → + residual → LayerNorm → MLP → + residual`. Stack dozens of these blocks and train on next-token prediction to obtain a language model.
