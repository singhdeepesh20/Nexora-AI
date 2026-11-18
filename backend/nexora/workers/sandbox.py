"""Isolated execution of untrusted student code.

Untrusted code never runs inside the backend process. Each run gets:

* a fresh temporary directory that is deleted afterwards
* a separate Python process started with -I (isolated mode) and a minimal environment
* a wall-clock timeout (process group killed on expiry)
* POSIX resource limits: CPU seconds, address space (Linux), file size, open files, process count
* an OS sandbox where available:
    - macOS: sandbox-exec profile denying all network access and file writes outside the run directory
    - Linux: bubblewrap (if installed) with a read-only root, private /tmp and no network namespace
    - Windows: no OS sandbox yet (timeout + audit-hook guards only)
* in-process audit hooks blocking sockets, subprocesses and writes outside the run directory

The `isolation` field of every result states which of these were actually active, so the UI can tell
students honestly how strong the isolation was. Audit hooks alone are NOT a security boundary.
"""

from __future__ import annotations

import os
import secrets
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

HARNESS = Path(__file__).with_name("harness.py")
MAX_OUTPUT_BYTES = 64_000
MAX_FILE_BYTES = 512_000


@dataclass
class ExecResult:
    exit_code: int | None
    timed_out: bool
    duration_ms: float
    stdout: str
    stderr: str
    payload: dict[str, Any] | None
    isolation: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class Limits:
    timeout_s: float = 10.0
    cpu_s: int = 10
    memory_mb: int = 1024
    max_processes: int = 64
    max_file_mb: int = 16


def _macos_profile(workdir: str) -> str:
    return f"""(version 1)
(allow default)
(deny network*)
(deny file-write*)
(allow file-write* (subpath "{workdir}") (literal "/dev/null") (literal "/dev/stdout") (literal "/dev/stderr"))
"""


def _detect_backend() -> str:
    if sys.platform == "darwin" and shutil.which("sandbox-exec"):
        return "macos-sandbox-exec"
    if sys.platform.startswith("linux") and shutil.which("bwrap"):
        return "linux-bubblewrap"
    return "none"


SANDBOX_BACKEND = _detect_backend()


def describe_isolation() -> dict[str, Any]:
    posix = os.name == "posix"
    return {
        "os_sandbox": SANDBOX_BACKEND,
        "network_blocked_by_os": SANDBOX_BACKEND != "none",
        "filesystem_writes_restricted_by_os": SANDBOX_BACKEND != "none",
        "resource_limits": posix,
        "audit_hook_guards": True,
        "timeout": True,
        "strength": "strong" if SANDBOX_BACKEND != "none" else ("moderate" if posix else "basic"),
        "notes": {
            "macos-sandbox-exec": "Network and writes outside the run folder are denied by the macOS sandbox.",
            "linux-bubblewrap": "Read-only filesystem, private /tmp, no network namespace.",
            "none": "No OS sandbox available: only timeouts, resource limits (POSIX) and Python audit hooks "
                    "apply. Do not run code you do not trust.",
        }[SANDBOX_BACKEND],
    }


def _preexec(limits: Limits):  # pragma: no cover - runs in child
    import resource

    def apply() -> None:
        os.setsid()
        resource.setrlimit(resource.RLIMIT_CPU, (limits.cpu_s, limits.cpu_s + 1))
        resource.setrlimit(resource.RLIMIT_FSIZE, (limits.max_file_mb * 2**20,) * 2)
        resource.setrlimit(resource.RLIMIT_NOFILE, (256, 256))
        if sys.platform.startswith("linux"):
            resource.setrlimit(resource.RLIMIT_AS, (limits.memory_mb * 2**20,) * 2)
            resource.setrlimit(resource.RLIMIT_NPROC, (limits.max_processes,) * 2)

    return apply


def _child_env(workdir: str) -> dict[str, str]:
    env = {
        "HOME": workdir, "TMPDIR": workdir, "TEMP": workdir, "TMP": workdir,
        "PYTHONHASHSEED": "0", "PYTHONIOENCODING": "utf-8", "PYTHONDONTWRITEBYTECODE": "1",
        "OMP_NUM_THREADS": "1", "OPENBLAS_NUM_THREADS": "1", "MKL_NUM_THREADS": "1",
        "MPLBACKEND": "Agg", "LANG": "C.UTF-8",
    }
    if os.name == "nt":  # Windows needs these to start Python at all
        for key in ("SYSTEMROOT", "PATH"):
            if key in os.environ:
                env[key] = os.environ[key]
    return env


def _validate_files(files: dict[str, str]) -> None:
    for name, content in files.items():
        p = Path(name)
        if p.is_absolute() or ".." in p.parts or len(p.parts) != 1 or not name.endswith((".py", ".txt", ".csv", ".json", ".md")):
            raise ValueError(f"Invalid sandbox file name: {name!r}")
        if len(content.encode("utf-8")) > MAX_FILE_BYTES:
            raise ValueError(f"File {name} exceeds {MAX_FILE_BYTES // 1000} KB")


def run_python(files: dict[str, str], mode: str = "tests", limits: Limits | None = None,
               entry: str = "main.py") -> ExecResult:
    """Run `mode` ("tests" or "script") over the given flat file set in an isolated child process."""
    limits = limits or Limits()
    _validate_files(files)
    if mode not in {"tests", "script"}:
        raise ValueError("mode must be 'tests' or 'script'")
    if mode == "script" and (entry not in files or not entry.endswith(".py")):
        raise ValueError(f"entry file {entry!r} is not among the files")
    workdir = os.path.realpath(tempfile.mkdtemp(prefix="nexora-run-"))
    nonce = "@@NEXORA-" + secrets.token_hex(16) + "@@"
    try:
        for name, content in files.items():
            Path(workdir, name).write_text(content, encoding="utf-8")
        shutil.copy(HARNESS, Path(workdir, "_nexora_harness.py"))
        cmd = [sys.executable, "-I", "-B", "_nexora_harness.py", mode, entry]
        if SANDBOX_BACKEND == "macos-sandbox-exec":
            cmd = ["sandbox-exec", "-p", _macos_profile(workdir)] + cmd
        elif SANDBOX_BACKEND == "linux-bubblewrap":
            cmd = ["bwrap", "--ro-bind", "/", "/", "--dev", "/dev", "--proc", "/proc", "--tmpfs", "/tmp",
                   "--bind", workdir, workdir, "--chdir", workdir, "--unshare-net", "--unshare-pid",
                   "--die-with-parent", "--new-session"] + cmd
        kwargs: dict[str, Any] = {}
        if os.name == "posix":
            kwargs["preexec_fn"] = _preexec(limits)
        else:
            kwargs["creationflags"] = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        start = time.perf_counter()
        proc = subprocess.Popen(cmd, cwd=workdir, env=_child_env(workdir), stdin=subprocess.PIPE,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)
        timed_out = False
        try:
            out, err = proc.communicate(input=(nonce + "\n").encode(), timeout=limits.timeout_s)
        except subprocess.TimeoutExpired:
            timed_out = True
            _kill(proc)
            out, err = proc.communicate()
        duration = (time.perf_counter() - start) * 1000
        stdout = out[:MAX_OUTPUT_BYTES * 4].decode("utf-8", "replace")
        payload, visible = _extract(stdout, nonce)
        return ExecResult(
            exit_code=proc.returncode, timed_out=timed_out, duration_ms=round(duration, 1),
            stdout=_cap(visible), stderr=_cap(err.decode("utf-8", "replace")), payload=payload,
            isolation=describe_isolation(),
        )
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def _kill(proc: subprocess.Popen) -> None:
    try:
        if os.name == "posix":
            os.killpg(proc.pid, signal.SIGKILL)
        else:
            proc.kill()
    except (ProcessLookupError, PermissionError, OSError):
        proc.kill()


def _extract(stdout: str, nonce: str) -> tuple[dict | None, str]:
    import json

    idx = stdout.rfind(nonce)
    if idx == -1:
        return None, stdout
    line = stdout[idx + len(nonce):].split("\n", 1)[0]
    try:
        payload = json.loads(line)
    except json.JSONDecodeError:
        payload = None
    return payload, stdout[:idx].rstrip("\n")


def _cap(text: str) -> str:
    return text if len(text) <= MAX_OUTPUT_BYTES else text[:MAX_OUTPUT_BYTES] + "\n... [output truncated]"
