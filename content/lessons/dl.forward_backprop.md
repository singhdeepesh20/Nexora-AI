# Forward Propagation and Backpropagation

## Forward pass

NEXORA uses the row convention: a batch `X` has shape `(n, inputs)` and a layer computes

```
Z = X W + b        W: (inputs, outputs), b: (outputs,)
A = φ(Z)
```

A layer with 4 inputs and 3 neurons has `W` of shape `(4, 3)`. The final layer's output is compared with the targets by a loss function.

## Backward pass

Backpropagation applies the chain rule from the loss back to every parameter, reusing the intermediate values stored during the forward pass. For one layer:

```
dZ = dA ⊙ φ'(Z)
dW = Xᵀ dZ / n
db = mean(dZ, axis=0)
dX = dZ Wᵀ           # passed to the previous layer
```

Computing all gradients costs about as much as one extra forward pass — that efficiency is why deep learning is practical.

## A beautiful simplification

With a sigmoid output and binary cross-entropy, the gradient with respect to the pre-activation is simply

```
∂L/∂z = p − y
```

For `p = 0.8`, `y = 1`: `−0.2`.

## Chain rule refresher

`z = 3x`, `y = z²` → `dy/dx = 2z · 3`. At `x = 1`: `2·3·3 = 18`.

## Gradient checking

Bugs in backprop rarely crash — they just make training silently worse. Compare each analytical gradient to a central finite difference `(L(θ+h) − L(θ−h)) / 2h`. Relative errors around `1e-7` mean your implementation is right; `1e-2` means a bug.

## Mission

*Train a Neural Network* asks you to implement this forward and backward pass in NumPy and train it on XOR. The tests run a gradient check against your code.
