"""Gradient Descent Laboratory - real optimisation on analytic 2-D functions."""

from __future__ import annotations

from typing import Literal

import numpy as np
from pydantic import BaseModel, Field

VERSION = "1.0"


class GDConfig(BaseModel):
    function: Literal["quadratic", "rosenbrock", "himmelblau", "saddle"] = "quadratic"
    a: float = Field(1.0, gt=0, le=50, description="quadratic/saddle x-curvature coefficient")
    b: float = Field(1.0, gt=0, le=50, description="quadratic/saddle y-curvature coefficient")
    optimizer: Literal["gd", "momentum", "rmsprop", "adam"] = "gd"
    learning_rate: float = Field(0.1, gt=0, le=10)
    momentum: float = Field(0.9, ge=0, lt=1)
    iterations: int = Field(100, ge=1, le=5000)
    start_x: float = Field(-4.0, ge=-10, le=10)
    start_y: float = Field(3.0, ge=-10, le=10)
    tolerance: float = Field(1e-6, gt=0, le=1)


def _fns(cfg: GDConfig):
    a, b = cfg.a, cfg.b
    if cfg.function == "quadratic":
        return (lambda x, y: a * x**2 + b * y**2,
                lambda x, y: np.array([2 * a * x, 2 * b * y]), (-6, 6, -6, 6))
    if cfg.function == "saddle":
        return (lambda x, y: a * x**2 - b * y**2,
                lambda x, y: np.array([2 * a * x, -2 * b * y]), (-6, 6, -6, 6))
    if cfg.function == "rosenbrock":
        return (lambda x, y: (1 - x) ** 2 + 100 * (y - x**2) ** 2,
                lambda x, y: np.array([-2 * (1 - x) - 400 * x * (y - x**2), 200 * (y - x**2)]), (-2.5, 2.5, -1.5, 4))
    return (lambda x, y: (x**2 + y - 11) ** 2 + (x + y**2 - 7) ** 2,
            lambda x, y: np.array([4 * x * (x**2 + y - 11) + 2 * (x + y**2 - 7),
                                   2 * (x**2 + y - 11) + 4 * y * (x + y**2 - 7)]), (-6, 6, -6, 6))


def _hessian(grad, x: float, y: float, h: float = 1e-4) -> np.ndarray:
    gx1, gx0 = grad(x + h, y), grad(x - h, y)
    gy1, gy0 = grad(x, y + h), grad(x, y - h)
    H = np.column_stack([(gx1 - gx0) / (2 * h), (gy1 - gy0) / (2 * h)])
    return (H + H.T) / 2


def run(cfg: GDConfig, ctx=None) -> dict:
    f, grad, bounds = _fns(cfg)
    p = np.array([cfg.start_x, cfg.start_y], dtype=float)
    v = np.zeros(2)
    s = np.zeros(2)
    m = np.zeros(2)
    beta2, eps = 0.999, 1e-8
    path, losses, gnorms = [p.copy()], [float(f(*p))], []
    initial_loss = losses[0]
    status = "max_iterations"
    with np.errstate(all="ignore"):
        for t in range(1, cfg.iterations + 1):
            g = grad(*p)
            gnorms.append(float(np.linalg.norm(g)))
            if gnorms[-1] < cfg.tolerance:
                status = "converged"
                break
            if cfg.optimizer == "gd":
                step = cfg.learning_rate * g
            elif cfg.optimizer == "momentum":
                v = cfg.momentum * v + g
                step = cfg.learning_rate * v
            elif cfg.optimizer == "rmsprop":
                s = 0.9 * s + 0.1 * g**2
                step = cfg.learning_rate * g / (np.sqrt(s) + eps)
            else:
                m = cfg.momentum * m + (1 - cfg.momentum) * g
                s = beta2 * s + (1 - beta2) * g**2
                mhat, shat = m / (1 - cfg.momentum**t), s / (1 - beta2**t)
                step = cfg.learning_rate * mhat / (np.sqrt(shat) + eps)
            p = p - step
            loss = float(f(*p))
            path.append(p.copy())
            losses.append(loss)
            # Diverged: non-finite, or |loss| grew a million-fold (for the saddle: unbounded below).
            if not np.all(np.isfinite(p)) or not np.isfinite(loss) or abs(loss) > max(1e6, abs(initial_loss) * 1e6):
                status = "diverged"
                break

    analysis = _analyse(cfg, grad, path, losses, status)
    xs = np.linspace(bounds[0], bounds[1], 60)
    ys = np.linspace(bounds[2], bounds[3], 60)
    X, Y = np.meshgrid(xs, ys)
    Z = f(X, Y)
    stride = max(1, len(path) // 400)
    pts = path[::stride] + ([path[-1]] if (len(path) - 1) % stride else [])
    lstride = max(1, len(losses) // 800)
    return {
        "status": status,
        "iterations_run": len(path) - 1,
        "final": {"x": _num(path[-1][0]), "y": _num(path[-1][1]), "loss": _num(losses[-1])},
        "path": [[_num(q[0]), _num(q[1])] for q in pts],
        "loss": [_num(v) for v in losses[::lstride]],
        "loss_stride": lstride,
        "grad_norm": [_num(v) for v in gnorms[::lstride]],
        "grid": {"x": xs.round(4).tolist(), "y": ys.round(4).tolist(), "z": np.round(Z, 4).tolist()},
        "analysis": analysis,
    }


def _num(v: float) -> float | None:
    v = float(v)
    return round(v, 8) if np.isfinite(v) else None


def _analyse(cfg: GDConfig, grad, path, losses, status) -> dict:
    notes: list[str] = []
    H0 = _hessian(grad, cfg.start_x, cfg.start_y)
    eig = np.linalg.eigvalsh(H0)
    lam_max = float(np.max(np.abs(eig)))
    stability_limit = 2 / lam_max if lam_max > 0 else None
    cond = float(np.max(np.abs(eig)) / max(np.min(np.abs(eig)), 1e-12))
    if cfg.optimizer == "gd" and stability_limit and cfg.function in ("quadratic", "saddle"):
        ratio = cfg.learning_rate / stability_limit
        if ratio > 1:
            notes.append(f"Learning rate {cfg.learning_rate} exceeds the stability limit 2/lambda_max = "
                         f"{stability_limit:.4g} (lambda_max = {lam_max:.4g}). Each step overshoots further, so the "
                         "iterates grow geometrically: divergence.")
        elif abs(ratio - 1) < 1e-9:
            notes.append("Learning rate is exactly at the stability limit: the iterate flips sign every step "
                         "along the steepest direction without shrinking - a perpetual oscillation.")
        elif ratio > 0.5:
            notes.append(f"Learning rate is {ratio:.0%} of the stability limit: expect oscillation (overshoot) "
                         "along the steepest direction before convergence.")
        else:
            notes.append(f"Learning rate is safely below the stability limit ({stability_limit:.4g}).")
    if cond > 10 and cfg.function == "quadratic":
        notes.append(f"Condition number {cond:.1f}: the valley is elongated, so plain gradient descent zig-zags "
                     "across it. Momentum or Adam usually helps.")
    if cfg.function == "saddle":
        notes.append("This surface has no minimum (it is unbounded below along y). Gradient descent escapes the "
                     "saddle point along the negative-curvature direction unless it starts exactly on y = 0.")
    if cfg.function == "himmelblau":
        notes.append("Himmelblau has four minima. Change the start point to reach a different one.")
    if status == "diverged":
        notes.append("Run stopped: the parameters or loss became non-finite or exploded.")
    elif status == "converged":
        notes.append(f"Converged: gradient norm fell below {cfg.tolerance:g} after {len(path) - 1} iterations.")
    else:
        notes.append("Iteration budget exhausted before the gradient-norm tolerance was reached.")

    flips = 0
    tail = np.array(path[-25:])
    if len(tail) > 3:
        d = np.diff(tail, axis=0)
        flips = int(np.sum(np.sign(d[1:]) * np.sign(d[:-1]) < 0))
        if flips > len(d) and status != "diverged":
            notes.append("Oscillation detected: successive steps keep reversing direction.")
    return {"lambda_max_at_start": round(lam_max, 6),
            "stability_limit_lr": round(stability_limit, 6) if stability_limit else None,
            "condition_number": round(cond, 4), "direction_reversals_recent": flips, "notes": notes}
