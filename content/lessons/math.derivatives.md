# Derivatives and Gradients

Learning in machine learning means *changing parameters to reduce a loss*. Derivatives tell us which direction to change them.

## The derivative is a slope

`f'(x)` is the instantaneous rate of change of `f` at `x`. For `f(x) = x²`, `f'(x) = 2x`, so at `x = 3` the slope is `6`.

Useful rules:

- Power rule: `d/dx xⁿ = n·xⁿ⁻¹`
- Sum rule: derivatives add
- **Chain rule**: `d/dx g(h(x)) = g'(h(x)) · h'(x)`

Example: `f(x) = (2x + 1)²`. Outer `g(u) = u²`, inner `h(x) = 2x + 1`. So `f'(x) = 2(2x + 1) · 2`; at `x = 1` this is `2·3·2 = 12`.

The chain rule is the entire mathematical basis of **backpropagation**.

## Partial derivatives and the gradient

For a function of several variables, a *partial derivative* varies one input while holding the others fixed. For `f(x, y) = x² + 3y`: `∂f/∂x = 2x`, `∂f/∂y = 3`.

The **gradient** `∇f = [∂f/∂x, ∂f/∂y, …]` is a vector that points in the direction of **steepest increase**. Its negative points downhill — the direction gradient descent follows.

## Numerical derivatives

You can approximate a derivative without calculus:

```python
def numeric_derivative(f, x, h=1e-5):
    return (f(x + h) - f(x - h)) / (2 * h)   # central difference
```

The central difference has error proportional to `h²`, far better than the one-sided `(f(x+h) - f(x)) / h`. Engineers use it for **gradient checking**: comparing a hand-derived gradient against the numerical one to catch bugs.
