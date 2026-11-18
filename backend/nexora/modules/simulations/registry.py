"""Simulation registry: maps simulation ids to config models and runners."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel

from nexora.modules.simulations import (
    gradient_descent,
    infrastructure,
    ml_lab,
    neural_network,
    rag,
    transformer,
)


@dataclass(frozen=True)
class SimulationSpec:
    id: str
    title: str
    district: str
    description: str
    config_model: type[BaseModel]
    runner: Callable[[Any, Any], dict]
    version: str
    kind: str  # "real" | "toy" | "estimate+measurement"


SIMULATIONS: dict[str, SimulationSpec] = {s.id: s for s in [
    SimulationSpec("gradient_descent", "Gradient Descent Laboratory", "machine_learning",
                   "Optimise analytic functions with GD, momentum, RMSProp and Adam; find the stability limit.",
                   gradient_descent.GDConfig, gradient_descent.run, gradient_descent.VERSION, "real"),
    SimulationSpec("neural_network", "Neural Network Laboratory", "deep_learning",
                   "Train a NumPy multilayer perceptron with backpropagation; break it with bad settings.",
                   neural_network.NNConfig, neural_network.run, neural_network.VERSION, "real"),
    SimulationSpec("ml_lab", "Machine Learning Laboratory", "machine_learning",
                   "Train scikit-learn classifiers and inspect confusion matrices, precision, recall and F1.",
                   ml_lab.MLConfig, ml_lab.run, ml_lab.VERSION, "real"),
    SimulationSpec("transformer", "Transformer Laboratory", "deep_learning",
                   "Inspect tokenisation, embeddings, positional encoding and multi-head attention (toy model).",
                   transformer.TransformerConfig, transformer.run, transformer.VERSION, "toy"),
    SimulationSpec("rag", "RAG Retrieval Laboratory", "deep_learning",
                   "Chunk, index and retrieve with BM25; measure recall@k and MRR on a labelled set.",
                   rag.RAGConfig, rag.run, rag.VERSION, "real"),
    SimulationSpec("infrastructure", "AI Infrastructure Laboratory", "foundation",
                   "Estimate inference memory/throughput across hardware and precision; measure your CPU.",
                   infrastructure.InfraConfig, infrastructure.run, infrastructure.VERSION, "estimate+measurement"),
]}


def run_simulation(sim_id: str, raw_config: dict[str, Any], ctx: Any = None) -> tuple[dict[str, Any], dict[str, Any]]:
    spec = SIMULATIONS[sim_id]
    cfg = spec.config_model.model_validate(raw_config)
    return cfg.model_dump(), spec.runner(cfg, ctx)


def summarize(sim_id: str, result: dict[str, Any]) -> dict[str, Any]:
    """Compact, storable summary of a run (full results are reproducible from config + version)."""
    if sim_id == "gradient_descent":
        return {"status": result["status"], "iterations": result["iterations_run"], "final": result["final"],
                "notes": result["analysis"]["notes"]}
    if sim_id == "neural_network":
        return {"status": result["status"], "final": result["final"], "diagnostics": result["diagnostics"]}
    if sim_id == "ml_lab":
        return {k: result[k] for k in ("train_accuracy", "test_accuracy", "macro_f1", "confusion_matrix", "notes")}
    if sim_id == "rag":
        return {"n_chunks": result["n_chunks"], "top": [r["doc_id"] for r in result["results"]],
                "evaluation": {k: v for k, v in (result["evaluation"] or {}).items() if k != "queries"}}
    if sim_id == "transformer":
        return {"tokens": result["tokens"], "permutation_test": result["permutation_test"]}
    return {"estimate": result["estimate"], "measurement": result["measurement"]}
