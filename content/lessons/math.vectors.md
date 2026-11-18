# Vectors and the Dot Product

A **vector** is an ordered list of numbers. In AI, almost everything becomes a vector: an image is a vector of pixel intensities, a word is an *embedding* vector, and a neuron's weights are a vector.

## Operations

For `a = [1, 2, 3]` and `b = [4, 5, 6]`:

- **Addition**: `a + b = [5, 7, 9]` (element-wise)
- **Scaling**: `2a = [2, 4, 6]`
- **Dot product**: `a · b = 1·4 + 2·5 + 3·6 = 32`

The dot product multiplies matching entries and adds them up. A single neuron computes exactly this: `w · x + b`.

## Length (norm)

The Euclidean norm is `‖a‖ = sqrt(a · a)`. For `[3, 4]` it is `sqrt(9 + 16) = 5`.

## Angle and cosine similarity

`a · b = ‖a‖ ‖b‖ cos θ`, so

```
cosine_similarity(a, b) = (a · b) / (‖a‖ ‖b‖)
```

- `1` → same direction
- `0` → perpendicular (orthogonal), e.g. `[1, 0]` and `[0, 1]`
- `-1` → opposite directions

Semantic search and RAG systems rank documents by the cosine similarity of their embedding vectors with a query vector.

## Matrices act on vectors

A matrix with shape `(m, n)` maps an `n`-vector to an `m`-vector: each output entry is the dot product of one matrix row with the input. A `3 × 2` matrix times a 2-vector produces a **3-vector**. A neural network layer is a matrix–vector product followed by a nonlinearity.

## NumPy

```python
import numpy as np
a, b = np.array([1, 2, 3]), np.array([4, 5, 6])
a @ b                 # 32
np.linalg.norm([3, 4])  # 5.0
```

Vectorised NumPy code runs in optimised C loops — orders of magnitude faster than Python loops for large arrays.
