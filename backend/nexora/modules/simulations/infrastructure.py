"""AI Infrastructure Laboratory.

Two clearly separated kinds of numbers:
* ESTIMATES - analytical model of inference memory, latency and throughput on hardware presets
  (roofline-style, ignores kernel efficiency, batching overheads and framework details).
* MEASUREMENTS - a real matrix-multiplication benchmark executed on THIS machine's CPU.
"""

from __future__ import annotations

import time
from typing import Literal

import numpy as np
from pydantic import BaseModel, Field

VERSION = "1.0"
BYTES = {"fp32": 4.0, "fp16": 2.0, "bf16": 2.0, "int8": 1.0, "int4": 0.5}
# name: (memory GB, memory bandwidth GB/s, dense fp16 TFLOP/s) - approximate public spec-sheet figures
HARDWARE = {
    "laptop_cpu": ("Laptop CPU (16 GB RAM)", 16, 60, 0.5),
    "laptop_igpu": ("Integrated GPU (shared 8 GB)", 8, 100, 4),
    "consumer_gpu_8gb": ("Consumer GPU, 8 GB", 8, 272, 30),
    "consumer_gpu_24gb": ("High-end consumer GPU, 24 GB", 24, 1000, 160),
    "datacenter_80gb": ("Data-centre GPU, 80 GB", 80, 2000, 300),
}


class InfraConfig(BaseModel):
    params_billion: float = Field(7.0, gt=0.01, le=400)
    precision: Literal["fp32", "fp16", "bf16", "int8", "int4"] = "fp16"
    hardware: Literal["laptop_cpu", "laptop_igpu", "consumer_gpu_8gb", "consumer_gpu_24gb", "datacenter_80gb"] = "consumer_gpu_24gb"
    batch_size: int = Field(1, ge=1, le=256)
    context_length: int = Field(4096, ge=128, le=131072)
    n_layers: int = Field(32, ge=1, le=160)
    hidden_size: int = Field(4096, ge=128, le=32768)
    run_benchmark: bool = True


def estimate(cfg: InfraConfig) -> dict:
    name, mem_gb, bw, tflops = HARDWARE[cfg.hardware]
    weight_gb = cfg.params_billion * 1e9 * BYTES[cfg.precision] / 1e9
    kv_gb = 2 * cfg.n_layers * cfg.context_length * cfg.hidden_size * cfg.batch_size * 2 / 1e9  # fp16 KV cache
    overhead_gb = 0.1 * weight_gb + 0.5
    total = weight_gb + kv_gb + overhead_gb
    flops_per_token = 2 * cfg.params_billion * 1e9
    mem_time = (weight_gb + kv_gb) / bw  # seconds per decode step (all weights + KV read once)
    compute_time = cfg.batch_size * flops_per_token / (tflops * 1e12)
    step = max(mem_time, compute_time)
    prefill = cfg.batch_size * cfg.context_length * flops_per_token / (tflops * 1e12)
    notes = []
    if total > mem_gb:
        notes.append(f"Does not fit: needs about {total:.1f} GB but the device has {mem_gb} GB. Quantise, shorten the "
                     "context, reduce the batch, or offload layers (much slower).")
    notes.append("Decode is memory-bandwidth-bound: every generated token reads all weights." if mem_time >= compute_time
                 else "Decode is compute-bound at this batch size: larger batches stop improving throughput.")
    if kv_gb > weight_gb:
        notes.append("The KV cache is larger than the weights - long contexts and big batches dominate memory.")
    if cfg.precision in ("int8", "int4"):
        notes.append("Quantisation cuts memory and bandwidth, but can reduce accuracy. The quality impact is "
                     "model-specific and must be measured on your task - this lab does not estimate it.")
    return {
        "kind": "estimate", "hardware": name,
        "memory_gb": {"weights": round(weight_gb, 3), "kv_cache": round(kv_gb, 3), "runtime_overhead": round(overhead_gb, 3),
                      "total": round(total, 3), "device_capacity": mem_gb},
        "fits": total <= mem_gb,
        "decode_step_ms": round(step * 1000, 3), "bound": "memory" if mem_time >= compute_time else "compute",
        "throughput_tokens_per_s": round(cfg.batch_size / step, 2),
        "time_to_first_token_ms": round(prefill * 1000, 2),
        "notes": notes,
    }


def benchmark(size: int = 384, repeats: int = 5) -> dict:
    rng = np.random.default_rng(0)
    out = {}
    for dtype in (np.float32, np.float64):
        A = rng.standard_normal((size, size)).astype(dtype)
        B = rng.standard_normal((size, size)).astype(dtype)
        A @ B
        times = []
        for _ in range(repeats):
            t0 = time.perf_counter()
            A @ B
            times.append(time.perf_counter() - t0)
        best = min(times)
        out[np.dtype(dtype).name] = {"best_ms": round(best * 1000, 3), "gflops": round(2 * size**3 / best / 1e9, 2)}
    return {"kind": "measurement", "device": "this machine's CPU (NumPy BLAS)", "matrix_size": size, "results": out}


def run(cfg: InfraConfig, ctx=None) -> dict:
    precisions = {}
    for p in BYTES:
        e = estimate(cfg.model_copy(update={"precision": p}))
        precisions[p] = {"total_gb": e["memory_gb"]["total"], "fits": e["fits"], "tokens_per_s": e["throughput_tokens_per_s"]}
    batches = {}
    for bsz in (1, 4, 16, 64):
        e = estimate(cfg.model_copy(update={"batch_size": bsz}))
        batches[bsz] = {"tokens_per_s": e["throughput_tokens_per_s"], "step_ms": e["decode_step_ms"],
                        "total_gb": e["memory_gb"]["total"], "fits": e["fits"]}
    return {"estimate": estimate(cfg), "precision_sweep": precisions, "batch_sweep": batches,
            "measurement": benchmark() if cfg.run_benchmark else None}
