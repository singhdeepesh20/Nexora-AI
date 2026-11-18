# Model Evaluation

A single accuracy number hides how a model fails. Engineers inspect the **confusion matrix**.

|            | predicted + | predicted − |
|------------|-------------|-------------|
| actual +   | TP          | FN          |
| actual −   | FP          | TN          |

## Metrics

With TP = 40, FP = 10, FN = 20, TN = 30:

- **Accuracy** = (TP + TN) / total = 70 / 100 = 0.70
- **Precision** = TP / (TP + FP) = 40 / 50 = 0.80 — *when I say positive, how often am I right?*
- **Recall** = TP / (TP + FN) = 40 / 60 ≈ 0.667 — *of all positives, how many did I find?*
- **F1** = 2·P·R / (P + R) ≈ 0.727 — harmonic mean, low if either is low

## Class imbalance

If 99% of transactions are legitimate, a model that always predicts "legitimate" scores 99% accuracy and catches zero fraud: recall = 0. On imbalanced problems report precision, recall and F1 per class.

## Overfitting

Training accuracy 1.00 with test accuracy 0.62 is a classic overfit: the model memorised the training set. Remedies: simpler models, regularisation, more data, early stopping.

## Underfitting

Low training *and* test accuracy means the model is too simple or features are uninformative.

## Cross-validation

k-fold cross-validation trains k models, each tested on a different held-out fold, and averages the scores — a more reliable estimate than one split on small datasets.

## Break it

In the ML Laboratory, train a decision tree with no depth limit on the wine dataset and compare training and test accuracy. Then limit the depth and watch the gap shrink.
