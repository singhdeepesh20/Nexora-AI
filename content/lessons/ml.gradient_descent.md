# Gradient Descent

Gradient descent minimises a loss by repeatedly stepping against the gradient:

```
θ ← θ − η · ∇L(θ)
```

`η` (eta) is the **learning rate**. Open the *Gradient Descent Laboratory* in this building to run every idea below on real functions.

## A worked step

`L(x) = x²`, `∇L = 2x`. From `x = 4` with `η = 0.25`: `x ← 4 − 0.25·8 = 2`.

## The learning rate decides everything

For a quadratic `L(x) = a·x²` the curvature is `L'' = 2a`. Gradient descent is stable only when

```
η < 2 / L''  =  1 / a
```

- `η` small → slow but steady convergence
- `η` near the limit → oscillation around the minimum
- `η` above the limit → **divergence**: every step overshoots further

For `L(x) = 5x²` the limit is `2 / 10 = 0.2`. For multi-dimensional functions, the *largest* curvature (largest Hessian eigenvalue) sets the limit, while the smallest curvature sets how slow progress is. Elongated valleys therefore zig-zag.

## Learn by breaking it

In the laboratory, set the learning rate just above `1.0` on the quadratic bowl with `a = 1`. Watch the loss explode — the lab explains why using the stability bound above.

## Better optimisers

- **Momentum** keeps a running velocity, damping zig-zags and accelerating along consistent directions.
- **RMSProp / Adam** scale each parameter's step by a running estimate of its gradient magnitude, adapting to uneven curvature.

## Convergence criteria

Stop when the gradient norm falls below a tolerance, when the loss stops improving, or after a maximum number of iterations.

## Non-convex losses

Neural network losses have many valleys. Gradient descent finds *a* local minimum that depends on the starting point — try the Himmelblau function from different starts and observe four different minima.
