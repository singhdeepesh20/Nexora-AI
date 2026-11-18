#!/usr/bin/env bash
# Start NEXORA (browser edition): builds the web app if needed, then serves everything from
# the local FastAPI backend on http://127.0.0.1:${NEXORA_PORT:-8765} (loopback only).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ ! -f "$ROOT/apps/web/dist/index.html" ]; then
  echo "Building the web interface (first run)…"
  (cd "$ROOT" && npx -y pnpm@9.15.9 install --frozen-lockfile && npx -y pnpm@9.15.9 build)
fi
cd "$ROOT/backend"
exec uv run python -m nexora "$@"
