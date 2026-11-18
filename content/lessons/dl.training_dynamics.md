# Training Dynamics

Training a network is an experiment. Loss curves are your instruments.

## Reading loss curves

- Loss decreasing smoothly → healthy.
- Loss flat from the start → learning rate too small, dead units, or a bug in gradients.
- Loss oscillating or becoming `NaN` → learning rate too large.
- Training loss falling while validation loss rises → **overfitting**.

## Learning rate and batch size

Small batches give noisy gradient estimates that can help escape sharp minima but make curves jumpy. Larger batches are smoother and use hardware better. Learning rate and batch size interact: larger batches often tolerate larger learning rates.

## Initialisation

All-zero weights make every neuron in a layer identical forever (symmetry). Random initialisation scaled to layer width (Xavier for tanh, He for ReLU) keeps activations and gradients in a healthy range.

## Regularisation

- **L2 weight decay** adds `λ‖w‖²` to the loss. With `λ = 0.01` and `w = [3, 4]` the penalty is `0.01 · 25 = 0.25`.
- **Early stopping** keeps the weights from the epoch with the best validation loss.
- **Dropout** randomly zeroes activations during training so the network cannot rely on any single unit.

## Optimisers

SGD with momentum and **Adam** are the defaults. Adam adapts per-parameter step sizes and usually converges faster with less tuning; well-tuned SGD sometimes generalises slightly better.

## Reproducibility

Fix random seeds, record the full configuration, and save results. Every NEXORA laboratory run is saved as a reproducible experiment record you can export.
