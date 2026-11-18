"""Runs inside the sandboxed child process. Copied into a throwaway directory per run.

It is NOT a security boundary by itself (the OS-level sandbox is). It adds
defence-in-depth guards against accidental network/process/file access and
produces a structured, nonce-tagged JSON result for the evaluator.

Usage: python -I -B harness.py <mode>      mode = "tests" | "script"
The nonce is read from stdin before any student code is imported.
"""

import contextlib
import io
import json
import os
import sys
import time
import traceback

WORKDIR = os.path.realpath(os.getcwd())
BLOCKED_EVENTS = {
    "socket.connect", "socket.bind", "socket.getaddrinfo", "subprocess.Popen", "os.system", "os.exec",
    "os.posix_spawn", "os.spawn", "os.fork", "os.forkpty", "os.kill", "os.startfile",
    "shutil.rmtree", "os.remove", "os.rmdir", "os.rename", "os.chmod",
}
MAX_CAPTURE = 8000


def _guard(event, args):
    if event in BLOCKED_EVENTS:
        if event in {"os.remove", "os.rename", "os.rmdir", "shutil.rmtree", "os.chmod"}:
            target = str(args[0]) if args else ""
            if os.path.realpath(target).startswith(WORKDIR + os.sep):
                return
        raise PermissionError(f"NEXORA sandbox: '{event}' is not allowed in exercises")
    if event == "open" and args:
        path, mode = args[0], args[1] if len(args) > 1 else "r"
        if isinstance(path, int):
            return
        writing = isinstance(mode, str) and any(c in mode for c in "wax+")
        if writing and not os.path.realpath(str(path)).startswith(WORKDIR + os.sep):
            raise PermissionError("NEXORA sandbox: writing outside the exercise directory is not allowed")


def _short(text):
    return text if len(text) <= MAX_CAPTURE else text[:MAX_CAPTURE] + "\n... [output truncated]"


def _emit(nonce, payload, real_stdout):
    real_stdout.write("\n" + nonce + json.dumps(payload) + "\n")
    real_stdout.flush()


def run_tests(nonce, real_stdout):
    import importlib

    result = {"import_error": None, "tests": []}
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            importlib.import_module("solution")
    except BaseException:  # noqa: BLE001 - student code may raise anything
        result["import_error"] = _short(traceback.format_exc(limit=6))
        _emit(nonce, result, real_stdout)
        return
    try:
        tests_mod = importlib.import_module("tests")
    except BaseException:  # noqa: BLE001
        result["import_error"] = _short(traceback.format_exc(limit=6))
        _emit(nonce, result, real_stdout)
        return
    names = [n for n in dir(tests_mod) if n.startswith("test_") and callable(getattr(tests_mod, n))]
    names.sort(key=lambda n: getattr(tests_mod, n).__code__.co_firstlineno)
    for name in names:
        buf = io.StringIO()
        start = time.perf_counter()
        status, message = "passed", ""
        try:
            with contextlib.redirect_stdout(buf):
                getattr(tests_mod, name)()
        except AssertionError as exc:
            status, message = "failed", str(exc) or "assertion failed"
        except NotImplementedError:
            status, message = "failed", "not implemented yet"
        except BaseException as exc:  # noqa: BLE001
            status = "error"
            message = f"{type(exc).__name__}: {exc}\n" + _short(traceback.format_exc(limit=4))
        result["tests"].append({
            "name": name, "status": status, "message": _short(message),
            "duration_ms": round((time.perf_counter() - start) * 1000, 2), "stdout": _short(buf.getvalue()),
        })
    _emit(nonce, result, real_stdout)


def run_script(nonce, real_stdout, entry):
    import runpy

    status, error = "ok", None
    try:
        runpy.run_path(entry, run_name="__main__")
    except SystemExit as exc:
        status = "ok" if exc.code in (None, 0) else "error"
    except BaseException:  # noqa: BLE001
        status, error = "error", _short(traceback.format_exc(limit=8))
    sys.stdout.flush()
    _emit(nonce, {"status": status, "error": error}, real_stdout)


def main():
    nonce = sys.stdin.readline().strip()
    mode = sys.argv[1] if len(sys.argv) > 1 else "tests"
    real_stdout = sys.stdout
    sys.path.insert(0, WORKDIR)
    sys.addaudithook(_guard)
    if mode == "tests":
        run_tests(nonce, real_stdout)
    else:
        entry = sys.argv[2] if len(sys.argv) > 2 else "main.py"
        run_script(nonce, real_stdout, os.path.basename(entry))


if __name__ == "__main__":
    main()
