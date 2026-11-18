# Probability and Statistics

Data is noisy. Statistics summarises it; probability reasons about uncertainty.

## Describing data

For `[2, 4, 4, 4, 5, 5, 7, 9]`:

- **Mean** = sum / count = `40 / 8 = 5`
- **Median** = middle value of the sorted data (average of the two middle values for even counts) = `4.5`
- **Variance** (population) = mean of squared deviations = `4`
- **Standard deviation** = `sqrt(variance) = 2`

The median is **robust to outliers**: one huge value drags the mean but barely moves the median. Sample variance divides by `n - 1` instead of `n` to correct the bias of estimating from a sample.

## Probability basics

- `P(A)` is between 0 and 1.
- Independent events: `P(A and B) = P(A)·P(B)`. Two fair coins both heads: `0.5 · 0.5 = 0.25`.
- Conditional probability: `P(A | B) = P(A and B) / P(B)`.

## Bayes' theorem

```
P(H | E) = P(E | H) · P(H) / P(E)
```

Suppose a disease affects 1% of people, a test detects 90% of true cases, and gives a false positive 10% of the time. For a positive test:

```
P(+) = 0.9·0.01 + 0.1·0.99 = 0.108
P(disease | +) = 0.009 / 0.108 ≈ 0.083
```

Only about 8%! Ignoring the **base rate** is one of the most common reasoning errors — and it is exactly why accuracy alone misleads on imbalanced datasets.

## The normal distribution

Many measurements cluster around a mean with a bell shape. About 68% of values fall within one standard deviation, 95% within two. Standardising a feature, `z = (x - mean) / std`, puts features on comparable scales — essential before gradient-based training.

## Missing values

Real datasets have gaps. Count them, decide whether to drop or impute them, and never silently treat a missing value as zero.
