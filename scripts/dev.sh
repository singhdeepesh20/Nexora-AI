#!/usr/bin/env bash
# Development: FastAPI backend (auto-reload off) + Vite dev server with hot reload.
# A per-launch token is shared via the environment; the Vite proxy attaches it to /api requests.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export NEXORA_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
export NEXORA_PORT="${NEXORA_PORT:-8765}"
export NEXORA_STATIC_DIR="$ROOT/.no-static"   # dev serves the UI from Vite instead
(cd "$ROOT/backend" && uv run python -m nexora --no-browser) &
BACKEND=$!
trap 'kill $BACKEND 2>/dev/null' EXIT INT TERM
cd "$ROOT/apps/web" && npx vite
