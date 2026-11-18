# Classification

Classification predicts a category. This building's *Machine Learning Laboratory* lets you train real scikit-learn classifiers on bundled datasets.

## Logistic regression

Compute a score `z = w·x + b` and squash it into a probability with the sigmoid:

```
σ(z) = 1 / (1 + e^(−z))      σ(0) = 0.5
```

Predict class 1 when `σ(z) ≥ 0.5`. The **decision boundary** is where `z = 0` — a line (or hyperplane).

## Binary cross-entropy

```
BCE = −[ y·log(p) + (1 − y)·log(1 − p) ]
```

For `y = 1, p = 0.5` the loss is `ln 2 ≈ 0.693`. Confident wrong predictions are punished severely: predicting `p = 0.99` when the truth is `0` costs `−ln(0.01) ≈ 4.6`.

## Other classifiers

- **k-nearest neighbours** votes among the k closest training points. `k = 1` memorises noise (overfits); large `k` smooths too much.
- **Decision trees** split features with thresholds; deep trees overfit, shallow trees underfit.
- **Random forests** average many randomised trees to reduce variance.
- **Support vector machines** find the boundary with the largest margin.

## Train/test split

A model must be judged on data it never saw. Training accuracy measures memorisation; **test accuracy estimates generalisation**. Always split before any fitting — including fitting a scaler — to avoid data leakage.

## Mission

The *Build a Classifier* mission asks you to implement logistic regression from scratch with NumPy. Hidden tests check your sigmoid, your gradients and your test accuracy.
