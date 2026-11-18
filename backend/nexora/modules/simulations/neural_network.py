"""Neural Network Laboratory - a real NumPy multilayer perceptron with backpropagation.

Deterministic for a given seed. CPU only, no GPU required.
"""

from __future__ import annotations

from typing import Literal

import numpy as np
from pydantic import BaseModel, Field, field_validator

VERSION = "1.0"


class NNConfig(BaseModel):
    dataset: Literal["xor", "circles", "moons", "spiral"] = "circles"
    n_samples: int = Field(200, ge=8, le=600)
    noise: float = Field(0.1, ge=0, le=1)
    hidden_layers: list[int] = Field(default_factory=lambda: [8, 8])
    activation: Literal["relu", "tanh", "sigmoid"] = "tanh"
    init: Literal["he", "xavier", "zeros", "large"] = "xavier"
    optimizer: Literal["sgd", "momentum", "adam"] = "adam"
    learning_rate: float = Field(0.03, gt=0, le=20)
    epochs: int = Field(300, ge=1, le=3000)
    batch_size: int | None = Field(None, ge=1, le=600)
    l2: float = Field(0.0, ge=0, le=1)
    test_fraction: float = Field(0.25, ge=0.1, le=0.5)
    seed: int = Field(0, ge=0, le=2**31 - 1)

    @field_validator("hidden_layers")
    @classmethod
    def _layers(cls, v: list[int]) -> list[int]:
        if len(v) > 5 or any(n < 1 or n > 64 for n in v):
            raise ValueError("at most 5 hidden layers with 1-64 neurons each")
        return v


def make_dataset(name: str, n: int, noise: float, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    if name == "xor":
        X = rng.uniform(-1, 1, (n, 2))
        y = ((X[:, 0] > 0) ^ (X[:, 1] > 0)).astype(float)
    elif name == "circles":
        r = np.where(np.arange(n) % 2 == 0, 0.4, 1.0)
        t = rng.uniform(0, 2 * np.pi, n)
        X = np.c_[r * np.cos(t), r * np.sin(t)]
        y = (r < 0.7).astype(float)
    elif name == "moons":
        half = n // 2
        t1, t2 = rng.uniform(0, np.pi, half), rng.uniform(0, np.pi, n - half)
        X = np.r_[np.c_[np.cos(t1), np.sin(t1)], np.c_[1 - np.cos(t2), 0.5 - np.sin(t2)]] - [0.5, 0.25]
        y = np.r_[np.zeros(half), np.ones(n - half)]
    else:
        half = n // 2
        t = np.sqrt(rng.uniform(0, 1, half)) * 3 * np.pi
        a = np.c_[t * np.cos(t), t * np.sin(t)] / (3 * np.pi)
        X = np.r_[a, -a[: n - half]]
        y = np.r_[np.zeros(half), np.ones(n - half)]
    X = X + rng.normal(0, noise * 0.3, X.shape)
    return X, y.reshape(-1, 1)


ACT = {
    "relu": (lambda z: np.maximum(0, z), lambda z, a: (z > 0).astype(float)),
    "tanh": (np.tanh, lambda z, a: 1 - a**2),
    "sigmoid": (lambda z: 1 / (1 + np.exp(-z)), lambda z, a: a * (1 - a)),
}


def _sigmoid(z: np.ndarray) -> np.ndarray:
    return np.where(z >= 0, 1 / (1 + np.exp(-np.clip(z, -500, 500))), np.exp(np.clip(z, -500, 500)) / (1 + np.exp(np.clip(z, -500, 500))))


class MLP:
    def __init__(self, sizes: list[int], activation: str, init: str, rng: np.random.Generator):
        self.act, self.dact = ACT[activation]
        self.W, self.b = [], []
        for fan_in, fan_out in zip(sizes[:-1], sizes[1:], strict=True):
            if init == "zeros":
                W = np.zeros((fan_in, fan_out))
            elif init == "large":
                W = rng.normal(0, 5.0, (fan_in, fan_out))
            elif init == "he":
                W = rng.normal(0, np.sqrt(2 / fan_in), (fan_in, fan_out))
            else:
                W = rng.normal(0, np.sqrt(1 / fan_in), (fan_in, fan_out))
            self.W.append(W)
            self.b.append(np.zeros(fan_out))

    def forward(self, X: np.ndarray):
        zs, acts = [], [X]
        a = X
        for i, (W, b) in enumerate(zip(self.W, self.b, strict=True)):
            z = a @ W + b
            a = _sigmoid(z) if i == len(self.W) - 1 else self.act(z)
            zs.append(z)
            acts.append(a)
        return zs, acts

    def backward(self, zs, acts, y, l2):
        n = y.shape[0]
        dz = (acts[-1] - y) / n  # sigmoid + BCE
        gW, gb = [None] * len(self.W), [None] * len(self.W)
        for i in reversed(range(len(self.W))):
            gW[i] = acts[i].T @ dz + l2 * self.W[i]
            gb[i] = dz.sum(0)
            if i > 0:
                da = dz @ self.W[i].T
                dz = da * self.dact(zs[i - 1], acts[i])
        return gW, gb


def _bce(p: np.ndarray, y: np.ndarray) -> float:
    p = np.clip(p, 1e-12, 1 - 1e-12)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def run(cfg: NNConfig, ctx=None) -> dict:
    rng = np.random.default_rng(cfg.seed)
    X, y = make_dataset(cfg.dataset, cfg.n_samples, cfg.noise, rng)
    idx = rng.permutation(len(X))
    n_test = max(2, int(len(X) * cfg.test_fraction))
    te, tr = idx[:n_test], idx[n_test:]
    Xtr, ytr, Xte, yte = X[tr], y[tr], X[te], y[te]
    net = MLP([2, *cfg.hidden_layers, 1], cfg.activation, cfg.init, rng)
    vel = [[np.zeros_like(w) for w in net.W], [np.zeros_like(b) for b in net.b]]
    sq = [[np.zeros_like(w) for w in net.W], [np.zeros_like(b) for b in net.b]]
    record_every = max(1, cfg.epochs // 150)
    hist = {"epoch": [], "train_loss": [], "test_loss": [], "train_acc": [], "test_acc": [], "grad_norms": []}
    status, t = "completed", 0
    bs = cfg.batch_size or len(Xtr)
    with np.errstate(all="ignore"):
        for epoch in range(1, cfg.epochs + 1):
            order = rng.permutation(len(Xtr))
            for start in range(0, len(Xtr), bs):
                bi = order[start:start + bs]
                zs, acts = net.forward(Xtr[bi])
                gW, gb = net.backward(zs, acts, ytr[bi], cfg.l2)
                t += 1
                for group, (params, grads) in enumerate(((net.W, gW), (net.b, gb))):
                    for i in range(len(params)):
                        g = grads[i]
                        if cfg.optimizer == "sgd":
                            params[i] -= cfg.learning_rate * g
                        elif cfg.optimizer == "momentum":
                            vel[group][i] = 0.9 * vel[group][i] + g
                            params[i] -= cfg.learning_rate * vel[group][i]
                        else:
                            vel[group][i] = 0.9 * vel[group][i] + 0.1 * g
                            sq[group][i] = 0.999 * sq[group][i] + 0.001 * g**2
                            mh, vh = vel[group][i] / (1 - 0.9**t), sq[group][i] / (1 - 0.999**t)
                            params[i] -= cfg.learning_rate * mh / (np.sqrt(vh) + 1e-8)
            if epoch % record_every == 0 or epoch == cfg.epochs or epoch == 1:
                _, a_tr = net.forward(Xtr)
                _, a_te = net.forward(Xte)
                ptr, pte = a_tr[-1], a_te[-1]
                if not (np.all(np.isfinite(ptr)) and all(np.all(np.isfinite(w)) for w in net.W)):
                    status = "diverged"
                    break
                zs, acts = net.forward(Xtr)
                gW, _ = net.backward(zs, acts, ytr, 0.0)
                hist["epoch"].append(epoch)
                hist["train_loss"].append(round(_bce(ptr, ytr), 6))
                hist["test_loss"].append(round(_bce(pte, yte), 6))
                hist["train_acc"].append(round(float(np.mean((ptr >= 0.5) == ytr)), 4))
                hist["test_acc"].append(round(float(np.mean((pte >= 0.5) == yte)), 4))
                hist["grad_norms"].append([round(float(np.linalg.norm(g)), 8) for g in gW])

    zs, acts = net.forward(Xtr)
    dead = []
    for a in acts[1:-1]:
        dead.append(round(float(np.mean(np.all(a <= 0, axis=0))) if cfg.activation == "relu" else 0.0, 4))
    gx = np.linspace(-1.6, 1.6, 40)
    GX, GY = np.meshgrid(gx, gx)
    with np.errstate(all="ignore"):
        grid = net.forward(np.c_[GX.ravel(), GY.ravel()])[1][-1].reshape(40, 40)
    grid = np.nan_to_num(grid, nan=0.5)
    params = int(sum(w.size + b.size for w, b in zip(net.W, net.b, strict=True)))
    diag = _diagnose(cfg, hist, dead, status, net)
    return {
        "status": status, "parameters": params, "history": hist,
        "final": {k: hist[k][-1] if hist[k] else None for k in ("train_loss", "test_loss", "train_acc", "test_acc")},
        "dead_relu_fraction": dead,
        "decision_grid": {"extent": [-1.6, 1.6], "size": 40, "p": np.round(grid, 3).tolist()},
        "points": {"train": np.round(np.c_[Xtr, ytr], 4).tolist(), "test": np.round(np.c_[Xte, yte], 4).tolist()},
        "diagnostics": diag,
    }


def _diagnose(cfg, hist, dead, status, net) -> list[str]:
    notes = []
    if status == "diverged":
        notes.append("Training diverged (non-finite weights or outputs). The learning rate is too large for this "
                     "setup - reduce it, or use Adam.")
        return notes
    if not hist["epoch"]:
        return notes
    if cfg.init == "zeros" and cfg.hidden_layers:
        same = all(np.allclose(W, W[:, :1]) for W in net.W[:-1])
        if same:
            notes.append("Symmetry problem: with all-zero initialisation every hidden neuron receives identical "
                         "gradients and stays identical, so the network behaves like a single neuron per layer.")
    if not cfg.hidden_layers and cfg.dataset in ("xor", "circles", "spiral"):
        notes.append("No hidden layer: the model is logistic regression and can only draw a straight boundary, "
                     f"which cannot separate the '{cfg.dataset}' classes.")
    if any(d > 0.5 for d in dead):
        notes.append(f"Dead ReLUs: {max(dead):.0%} of neurons in a layer never activate on the training set and "
                     "receive zero gradient. Lower the learning rate or use He initialisation.")
    g0 = hist["grad_norms"][0] if hist["grad_norms"] else []
    if len(g0) >= 3 and g0[-1] > 0 and g0[0] / g0[-1] < 1e-3:
        notes.append("Vanishing gradients: the first layer's gradient is over 1000x smaller than the last layer's. "
                     "Deep sigmoid stacks cause this; try ReLU or tanh with proper initialisation.")
    tr, te = hist["train_acc"][-1], hist["test_acc"][-1]
    if tr - te > 0.12:
        notes.append(f"Overfitting: train accuracy {tr:.0%} vs test {te:.0%}. Add L2 regularisation, reduce "
                     "network size, or add data.")
    if tr < 0.75:
        notes.append(f"Underfitting: train accuracy only {tr:.0%}. Increase capacity, train longer or tune the "
                     "learning rate.")
    losses = hist["train_loss"]
    if len(losses) > 6:
        diffs = np.diff(losses[-6:])
        if np.sum(diffs > 0) >= 3 and np.sum(diffs < 0) >= 2:
            notes.append("The loss curve is oscillating - a sign the learning rate is close to too large.")
    if not notes:
        notes.append("Healthy training run: loss decreased and train/test accuracy are close.")
    return notes
