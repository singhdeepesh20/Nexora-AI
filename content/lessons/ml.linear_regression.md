# Linear Regression

Linear regression predicts a number from features with a weighted sum: `ŷ = w·x + b`. For `w = 2`, `b = 1`, `x = 3` the prediction is `7`.

## Loss: mean squared error

```
MSE = (1/n) Σ (ŷᵢ − yᵢ)²
```

Predictions `[2, 4]` against targets `[3, 3]` give `((−1)² + 1²) / 2 = 1`.

## Gradients

```
∂MSE/∂w = (2/n) Σ (ŷᵢ − yᵢ) · xᵢ
∂MSE/∂b = (2/n) Σ (ŷᵢ − yᵢ)
```

Plug these into gradient descent and you have trained your first model.

## Closed form

Linear regression also has an exact solution, the normal equations `w = (XᵀX)⁻¹ Xᵀy`. It is used for small problems; gradient descent scales to large data and generalises to models without closed forms.

## Feature scaling

If one feature ranges 0–1 and another 0–100 000, the loss surface becomes a stretched valley: the stable learning rate is set by the steep direction while progress along the flat direction crawls. **Standardising** features makes curvature similar in all directions so gradient descent converges much faster.

## Measuring fit: R²

```
R² = 1 − SS_residual / SS_total
```

`R² = 1` is a perfect fit. A model that always predicts the mean scores exactly `0`. Negative values mean the model is worse than predicting the mean.

## Assumptions to check

Linear relationship, independent errors, no extreme outliers dominating the squared loss. When they fail, transform features or choose a different model.
