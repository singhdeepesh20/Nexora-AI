# Neurons and Activation Functions

An artificial neuron computes a weighted sum and applies a nonlinearity:

```
a = φ(w · x + b)
```

With `w = [1, −2]`, `b = 0.5`, `x = [3, 1]`: `z = 3 − 2 + 0.5 = 1.5`, and `ReLU(1.5) = 1.5`.

## Activation functions

| Function | Formula | Range | Notes |
|----------|---------|-------|-------|
| Sigmoid | `1/(1+e^−z)` | (0, 1) | derivative at most **0.25** → gradients vanish in deep stacks |
| Tanh | `(e^z−e^−z)/(e^z+e^−z)` | (−1, 1) | zero-centred, still saturates |
| ReLU | `max(0, z)` | [0, ∞) | cheap, does not saturate for z > 0; `ReLU(−3) = 0` |

## Why nonlinearity matters

Stacking linear layers gives another linear function: `W₂(W₁x) = (W₂W₁)x`. Without activations, a 100-layer network is just linear regression.

## XOR: the classic example

XOR outputs 1 when exactly one input is 1. No single line separates its classes, so a single neuron cannot learn it. One hidden layer with a nonlinearity can. Try it in the *Neural Network Laboratory*: remove the hidden layer and accuracy stalls at 50–75%.

## Failure modes to break on purpose

- **Dead ReLUs**: if a neuron's input is always negative, its gradient is zero forever. Very large learning rates cause this. The lab reports the fraction of dead units.
- **Vanishing gradients**: stack many sigmoid layers and the early layers barely learn; the lab plots gradient norms per layer.
