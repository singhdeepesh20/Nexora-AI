# Development

## Prerequisites

Node.js ≥ 22, Python 3.12, [uv](https://docs.astral.sh/uv/). pnpm is invoked as `npx pnpm@9.15.9` (or enable Corepack). Rust stable is needed only for the future desktop shell.

```bash
npx pnpm@9.15.9 install          # JS workspace (apps/web, packages/*)
(cd backend && uv sync)          # Python env from uv.lock
pnpm dev                         # backend :8765 + Vite :5173 with hot reload
pnpm start                       # production-style: backend serves apps/web/dist on :8765
```

`pnpm dev` generates a per-launch token, passes it to the backend (`NEXORA_TOKEN`) and to the Vite proxy, which attaches it to `/api` calls.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXORA_DATA_DIR` | OS user data dir | Where student data lives |
| `NEXORA_PORT` | 8765 | Backend port (loopback) |
| `NEXORA_CONTENT_DIR` | `<repo>/content` | Curriculum source |
| `NEXORA_STATIC_DIR` | `<repo>/apps/web/dist` | Built frontend to serve |
| `NEXORA_OLLAMA_URL` | `http://127.0.0.1:11434` | Must be loopback |
| `NEXORA_TOKEN` | random | Fixed token (dev only) |

## Layout

```
apps/web            React + R3F frontend (Vite)
packages/world-engine   pure TS movement/collision/interaction
packages/shared-types   API types
backend/nexora      FastAPI app: api/, core/, modules/, infrastructure/, workers/
backend/migrations  Alembic migrations
content/            curriculum, lessons, assessments, missions (data)
docs/               format & model specifications
scripts/            start/dev launchers
```

## Database migrations

Edit `backend/nexora/infrastructure/database/models.py`, then:

```bash
cd backend && uv run alembic -x db=/tmp/dev.db upgrade head && uv run alembic -x db=/tmp/dev.db revision --autogenerate -m "describe change"
```

Review the generated file (SQLite uses batch mode). Migrations run automatically at app start, after copying the existing DB to `backups/`. Bump `SYNC_FORMAT` in `modules/curriculum/sync.py` if you change how content is indexed.
