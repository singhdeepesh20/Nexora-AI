"""Static code-quality checks (no execution). Deterministic and explainable."""

from __future__ import annotations

import ast
from typing import Any

MAX_FUNCTION_LINES = 60


def analyze(code: str) -> dict[str, Any]:
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return {"score": 0.0, "syntax_error": f"line {exc.lineno}: {exc.msg}", "checks": []}

    funcs = [n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))]
    public = [f for f in funcs if not f.name.startswith("_")]
    documented = [f for f in public if ast.get_docstring(f)]
    bare_excepts = [n.lineno for n in ast.walk(tree) if isinstance(n, ast.ExceptHandler) and n.type is None]
    star_imports = [n.lineno for n in ast.walk(tree) if isinstance(n, ast.ImportFrom) and any(a.name == "*" for a in n.names)]
    globals_used = [n.lineno for n in ast.walk(tree) if isinstance(n, ast.Global)]
    long_funcs = [f.name for f in funcs if isinstance(f, (ast.FunctionDef, ast.AsyncFunctionDef))
                  and (f.end_lineno or f.lineno) - f.lineno + 1 > MAX_FUNCTION_LINES]
    stubs = [f.name for f in funcs if isinstance(f, (ast.FunctionDef, ast.AsyncFunctionDef)) and any(
        isinstance(n, ast.Raise) and isinstance(n.exc, (ast.Name, ast.Call))
        and getattr(n.exc, "id", getattr(getattr(n.exc, "func", None), "id", None)) == "NotImplementedError"
        for n in ast.walk(f))]

    checks = [
        {"id": "docstrings", "label": "Public functions and classes have docstrings",
         "ratio": len(documented) / len(public) if public else 1.0,
         "detail": [f.name for f in public if f not in documented]},
        {"id": "no_bare_except", "label": "No bare `except:` clauses (they hide real errors)",
         "ratio": 0.0 if bare_excepts else 1.0, "detail": bare_excepts},
        {"id": "no_star_import", "label": "No wildcard imports", "ratio": 0.0 if star_imports else 1.0, "detail": star_imports},
        {"id": "no_global", "label": "No `global` state", "ratio": 0.0 if globals_used else 1.0, "detail": globals_used},
        {"id": "short_functions", "label": f"Functions are at most {MAX_FUNCTION_LINES} lines",
         "ratio": 0.0 if long_funcs else 1.0, "detail": long_funcs},
        {"id": "no_stubs", "label": "No unimplemented stubs left", "ratio": 0.0 if stubs else 1.0, "detail": stubs},
    ]
    score = sum(c["ratio"] for c in checks) / len(checks)
    return {"score": round(score, 4), "syntax_error": None, "checks": checks}
