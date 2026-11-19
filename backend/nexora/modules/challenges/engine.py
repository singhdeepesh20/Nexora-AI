"""Break Challenges: declarative targets evaluated against real simulation output.

A target condition is one of:
  {"metric": name, "op": op, "value": v}   - a metric extracted from the result
  {"config": key,  "op": op, "value": v}   - a constraint on the configuration actually used
  {"event": TYPE} / {"no_event": TYPE}     - presence/absence of a classified event
The student may only change `allowed` keys; everything else is fixed to `initial_config` server-side.
"""

from __future__ import annotations

import json
import operator
from pathlib import Path
from typing import Any

from nexora.modules.simulations.events import classify
from nexora.modules.simulations.registry import SIMULATIONS, run_simulation, summarize

OPS = {">=": operator.ge, ">": operator.gt, "<=": operator.le, "<": operator.lt, "==": operator.eq, "!=": operator.ne}


class ChallengeError(ValueError):
    pass


def load_challenges(content_dir: Path) -> dict[str, dict[str, Any]]:
    data = json.loads((content_dir / "challenges" / "challenges.json").read_text(encoding="utf-8"))
    out = {}
    for c in data["challenges"]:
        if c["lab"] not in SIMULATIONS:
            raise ChallengeError(f"Challenge {c['id']} uses unknown lab {c['lab']}")
        SIMULATIONS[c["lab"]].config_model.model_validate(c["initial_config"])  # must be runnable as-is
        for cond in c["target"]:
            if "op" in cond and cond["op"] not in OPS:
                raise ChallengeError(f"Challenge {c['id']} has unknown operator {cond['op']}")
        out[c["id"]] = c
    return out


