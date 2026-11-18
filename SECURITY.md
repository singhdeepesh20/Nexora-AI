# Security

## Reporting

Please report vulnerabilities privately through GitHub Security Advisories on this repository rather than in public issues. We aim to acknowledge reports within 7 days.

## Threat model

NEXORA runs on a student's own computer. The main threats are (1) web pages in the student's browser attacking the local API, (2) untrusted code - student code, code pasted from the internet, imported projects - harming the machine, and (3) malicious backup archives.

| Control | Implementation |
|---------|----------------|
| Loopback only | Uvicorn binds `127.0.0.1`; Vite dev server binds `127.0.0.1` |
| Per-launch access token | Random token required on every `/api` request except `/health`; injected into the same-origin HTML (prod) or attached by the dev proxy. Compared in constant time |
| DNS rebinding | `Host` header must be a loopback name |
| CORS | No CORS middleware: cross-origin pages cannot read responses |
| CSP | `default-src 'self'`, no inline scripts, `frame-ancestors 'none'` |
| Filesystem | The frontend never sees paths. Workspace files are flat names matching `^[A-Za-z0-9_-]{1,64}\.(py|md|txt|json|csv)$`, 512 KB each, 50 per project, atomic writes |
| Backups | Zip members validated (no absolute paths, `..`, symlinks, size/entry caps); SHA-256 of every file verified before any change; schema revision checked; safety copy of the DB before restore |
| Local AI | Ollama URL must be loopback; mentors have no tools - they cannot execute code or read files; unavailable models fall back to deterministic answers |
| Telemetry | None |

## Code execution sandbox

Untrusted code never runs inside the backend process. Each run uses a fresh temporary directory, `python -I -B` with a minimal environment, a wall-clock timeout that kills the process group, and an in-process audit hook that blocks sockets, subprocesses and writes outside the run folder.

| Platform | OS-level isolation | Strength reported |
|----------|--------------------|-------------------|
| macOS | `sandbox-exec` profile: all network denied, file writes denied outside the run folder; plus RLIMIT_CPU / FSIZE / NOFILE | strong |
| Linux with `bubblewrap` | read-only root, private `/tmp`, network & PID namespaces; plus rlimits incl. address space and process count | strong |
| Linux without `bubblewrap` | rlimits only | moderate |
| Windows | none yet (timeout + audit hook only) | basic |

**Limitations, stated plainly:** Python audit hooks are defence in depth, not a security boundary - determined code can bypass them. On "moderate" and "basic" platforms, only run code you trust. Memory limits are not enforced by macOS (`RLIMIT_AS` is unsupported). `sandbox-exec` is deprecated by Apple and may change. Mission integrity (a student fooling the grader) is protected against accidents, not against deliberate cheating of one's own learning. The isolation level of every run is returned with its result and shown in the UI.
