"""Machine Learning Laboratory - real scikit-learn training on bundled (offline) datasets."""

from __future__ import annotations

from typing import Literal

import numpy as np
from pydantic import BaseModel, Field
from sklearn import datasets
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier

VERSION = "1.0"
LOADERS = {"iris": datasets.load_iris, "wine": datasets.load_wine, "breast_cancer": datasets.load_breast_cancer}


class MLConfig(BaseModel):
    dataset: Literal["iris", "wine", "breast_cancer"] = "iris"
    model: Literal["logistic_regression", "knn", "decision_tree", "random_forest", "svm"] = "logistic_regression"
    standardize: bool = True
    test_size: float = Field(0.25, ge=0.1, le=0.5)
    features: list[int] | None = None
    seed: int = Field(42, ge=0, le=2**31 - 1)
    max_depth: int | None = Field(None, ge=1, le=50)
    n_neighbors: int = Field(5, ge=1, le=50)
    C: float = Field(1.0, gt=0, le=1000)
    n_estimators: int = Field(100, ge=1, le=300)
    label_noise: float = Field(0.0, ge=0, le=0.5, description="fraction of training labels randomly flipped")


def dataset_info() -> dict:
    out = {}
    for name, loader in LOADERS.items():
        d = loader()
        out[name] = {"n_samples": int(d.data.shape[0]), "features": list(map(str, d.feature_names)),
                     "classes": list(map(str, d.target_names))}
    return out


def _model(cfg: MLConfig):
    if cfg.model == "logistic_regression":
        return LogisticRegression(C=cfg.C, max_iter=2000)
    if cfg.model == "knn":
        return KNeighborsClassifier(n_neighbors=cfg.n_neighbors)
    if cfg.model == "decision_tree":
        return DecisionTreeClassifier(max_depth=cfg.max_depth, random_state=cfg.seed)
    if cfg.model == "random_forest":
        return RandomForestClassifier(n_estimators=cfg.n_estimators, max_depth=cfg.max_depth, random_state=cfg.seed)
    return SVC(C=cfg.C, random_state=cfg.seed)


def run(cfg: MLConfig, ctx=None) -> dict:
    d = LOADERS[cfg.dataset]()
    X, y = d.data, d.target
    names = list(map(str, d.feature_names))
    if cfg.features:
        if any(i < 0 or i >= X.shape[1] for i in cfg.features):
            raise ValueError(f"feature indices must be in 0..{X.shape[1] - 1}")
        X = X[:, cfg.features]
        names = [names[i] for i in cfg.features]
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=cfg.test_size, random_state=cfg.seed, stratify=y)
    flipped = 0
    if cfg.label_noise > 0:
        rng = np.random.default_rng(cfg.seed)
        ytr = ytr.copy()
        k = int(round(cfg.label_noise * len(ytr)))
        idx = rng.choice(len(ytr), size=k, replace=False)
        classes = np.unique(y)
        ytr[idx] = [rng.choice(classes[classes != v]) for v in ytr[idx]]
        flipped = k
    model = make_pipeline(StandardScaler(), _model(cfg)) if cfg.standardize else _model(cfg)
    model.fit(Xtr, ytr)  # scaler is fitted on the training split only -> no leakage
    ptr, pte = model.predict(Xtr), model.predict(Xte)
    classes = list(map(str, d.target_names))
    report = classification_report(yte, pte, target_names=classes, output_dict=True, zero_division=0)
    train_acc, test_acc = float(accuracy_score(ytr, ptr)), float(accuracy_score(yte, pte))
    notes = []
    if train_acc - test_acc > 0.08:
        notes.append(f"Overfitting: train accuracy {train_acc:.1%} vs test {test_acc:.1%}. Constrain the model "
                     "(e.g. max_depth, larger k, smaller C).")
    if test_acc < 0.8:
        notes.append("Test accuracy below 80%: the model is underfitting or the selected features carry little "
                     "signal.")
    if not cfg.standardize and cfg.model in ("knn", "svm", "logistic_regression"):
        notes.append("Features are not standardised. Distance- and margin-based models are sensitive to feature "
                     "scale; compare with standardisation enabled.")
    if flipped:
        notes.append(f"{flipped} training labels were deliberately corrupted. Watch how flexible models memorise "
                     "the noise while test accuracy falls.")
    if not notes:
        notes.append("Train and test accuracy are close: the model generalises well on this split.")
    return {
        "train_accuracy": round(train_acc, 4), "test_accuracy": round(test_acc, 4),
        "n_train": int(len(ytr)), "n_test": int(len(yte)), "features": names, "classes": classes,
        "confusion_matrix": confusion_matrix(yte, pte).tolist(),
        "per_class": {c: {k: round(float(report[c][k]), 4) for k in ("precision", "recall", "f1-score", "support")}
                      for c in classes},
        "macro_f1": round(float(report["macro avg"]["f1-score"]), 4),
        "labels_flipped": flipped, "notes": notes,
    }
