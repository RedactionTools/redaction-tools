---
name: run-stack
description: Run redaction-tools locally and verify it actually works - start Postgres, the Django API and the Next.js frontend, then smoke-test them. Use when asked to run, start, serve, or screenshot the app, or to confirm a change works in the real stack rather than only in tests.
---

# Running the stack

Two modes. Prefer **host mode** for day-to-day work: it reloads faster and the
logs are readable.

## Host mode (recommended)

```bash
make up              # Postgres in Docker only
make backend-migrate
make backend         # http://localhost:8007  (blocking)
make frontend        # http://localhost:3007  (blocking, separate shell)
make backend-worker  # django-q2, only if testing background tasks
```

`make backend` and `make frontend` block, so run them in the background when
driving them from a tool, and stop them when finished.

## Full Docker

```bash
make stack   # db + backend + qcluster + frontend
make logs    # tail
make down    # stop
```

`make stack` requires `SECRET_KEY` *and* `AUTH_SECRET` in the repo-root `.env`;
compose refuses to start without them.

## Ports

| Service | Port | Note |
| --- | --- | --- |
| Backend | 8007 | `BACKEND_PORT` |
| Frontend | 3007 | `FRONTEND_PORT` |
| Postgres | 5432 default, **5433 on this machine** | `POSTGRES_PORT`; 5432 is already taken here |

Before assuming a port is free: `lsof -nP -iTCP:<port> -sTCP:LISTEN`.

## Smoke checks

```bash
curl -s localhost:8007/api/v1/health     # {"status":"ok","database":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' localhost:3007          # 200
curl -s -o /dev/null -w '%{http_code}\n' localhost:8007/api/v1/auth/me   # 401 without a token
```

`/api/v1/health` returns **200 with `"status":"degraded"`** when the database is
unreachable — read the body, not just the status code.

Useful URLs: `/admin/`, `/api/v1/docs`, `/_allauth/openapi.html` (local only).

## Verifying in the browser

Use the Chrome tools for anything visual or auth-related, and report what
actually rendered rather than assuming. `/` and `/health` work signed out;
`/account` redirects to `/auth/signin` unless a session exists.

## When it will not start

- **Port already allocated** → another process owns it; check with `lsof` above.
- **Frontend 500 on every page** → missing `AUTH_SECRET` or `NEXT_PUBLIC_API_URL`;
  compare `frontend/.env.local` against `frontend/.env.example`.
- **Frontend loads but every API call fails** → the backend is not running, or
  `NEXT_PUBLIC_API_URL` points at the wrong port.
- **Sign-in problems** → see the `auth-flow` skill.
