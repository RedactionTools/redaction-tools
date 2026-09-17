# redaction-tools

Catalog/directory of redaction tools with benchmarks and a leaderboard.
`backend/` is Django + django-ninja; `frontend/` is Next.js on bun.

## Use `make`, not the underlying tools

`make help` lists every target. Targets are namespaced per component
(`backend-*`, `frontend-*`) and the unprefixed aggregates run the task
everywhere: `make test`, `lint`, `fmt`, `check`, `schema`, `install`.

Run `make backend` / `make frontend` rather than `uv run manage.py runserver` or
`bun run dev`, so the ports stay consistent.

| Service | URL |
| --- | --- |
| Backend | http://localhost:8007 (`/admin/`, `/api/v1/docs`, `/api/v1/health`) |
| Frontend | http://localhost:3007 |
| Postgres | 5432 by default; **5433 on this machine** (5432 is taken) |

## The API contract is generated, in two steps

The chain is: Python routers → `backend/openapi.json` → `frontend/src/lib/api/generated/`.
Both generated artifacts are **committed**, and CI fails if either is stale.

After changing any endpoint:

```bash
make schema   # regenerates openapi.json AND the TypeScript client
```

- **Never hand-edit** `backend/openapi.json` or anything under
  `frontend/src/lib/api/generated/`.
- Operation ids come from the **view function name** (`RedactionAPI` in
  `config/api.py` overrides ninja's dotted-path default). `def get_me` becomes a
  `useGetMe()` hook, so view names must be unique across the whole API —
  `backend/tests/test_openapi_schema.py` enforces that.
- The spec declares no 4xx responses, so generated hooks are typed with
  `ApiError` via the `Register` augmentation in `src/types/react-query.d.ts`.

## Auth

The frontend never uses session cookies against `/api/`. It gets a Google ID
token, trades it at `/_allauth/app/v1/auth/provider/token` for our own JWT pair,
and sends the access token as a bearer. Refresh tokens **rotate** — the new one
must replace the old. Access tokens live 15 minutes.

Session cookies still exist, but only for the Django admin and the
server-rendered `/accounts/` allauth views.

Google credentials come from environment variables, **not** a `SocialApp` row in
the admin — configuring both raises `MultipleObjectsReturned`.

## Conventions

- Tests come first; the repo carries tdd-guard's rulebook in
  `.claude/tdd-guard/data/`. One failing test at a time, then minimal code.
- Backend: ruff, line length 100, tests in `backend/tests/`, pytest fixtures in
  `backend/conftest.py`.
- Frontend: see `frontend/CLAUDE.md`.
- `.env` files are gitignored; `.env.example` files are the documented contract
  and must stay in sync when a variable is added.
