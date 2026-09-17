# redaction-tools

Catalog / directory of redaction tools with benchmarks and a leaderboard — [redaction-tools.com](https://redaction-tools.com).

This repository holds the **backend skeleton** (a Django project with the API, admin and Google
authentication wired up, but no domain models yet) and the **frontend foundation** in `frontend/`
(Next.js + TypeScript on bun, talking to the API with the JWTs described below). The catalog,
benchmark and leaderboard pages arrive once the domain models do.

## Stack

| Area | Choice |
| --- | --- |
| Framework | Django 6.1 (Python 3.13) |
| API | django-ninja (`/api/v1/`), OpenAPI at `/api/v1/docs` |
| Auth | django-allauth headless + Google, issuing our own JWTs |
| Admin | django-unfold |
| Background jobs | django-q2 (ORM broker) |
| Database | PostgreSQL 17 |
| Tooling | uv, ruff, pytest, pre-commit, make |
| Frontend | Next.js 16 (App Router), React 19, Tailwind v4, TanStack Query, Orval, NextAuth |
| Frontend tooling | bun, vitest, ESLint, Prettier |
| Deploy | Docker Compose, GitHub Actions CI |

## Layout

```
backend/            Django project
  config/           settings (base/local/production/test), urls, api, wsgi/asgi
  apps/core/        shared base models + /health
  apps/accounts/    user model, JWT, allauth glue, admin
  tests/
  openapi.json      committed schema; the Orval input
frontend/           Next.js app
  src/app/          routes: (site) chrome, auth/, api/auth/[...nextauth]
  src/lib/api/      generated/ (Orval) + the fetch mutator and token source
  src/lib/auth/     framework-free token logic (exchange, refresh, expiry)
  src/features/     components that fetch data
  src/components/   ui/ primitives, layout chrome, providers
docker-compose.yml  db + backend + qcluster + frontend
Makefile            make help
docs/               requirements
```

## Getting started

```bash
cp .env.example .env                       # compose settings — set SECRET_KEY and AUTH_SECRET
cp backend/.env.example backend/.env       # local Django settings — set SECRET_KEY
cp frontend/.env.example frontend/.env.local
make up                                    # start Postgres
make install                               # uv sync + bun install + git hooks
make backend-migrate
make backend-superuser
make backend                               # http://localhost:8007
make frontend                              # http://localhost:3007
```

Or run everything in Docker: `make stack`.

Ports are 8007 (backend) and 3007 (frontend), overridable with `BACKEND_PORT` / `FRONTEND_PORT`.

Useful URLs: `/admin/`, `/api/v1/docs`, `/api/v1/health`, `/_allauth/openapi.html` (local only).

`make help` lists every target. They are namespaced per component — `make backend`,
`make backend-test`, `make backend-worker` — and `frontend-*` targets will join them; the
unprefixed aggregates (`make test`, `lint`, `fmt`, `check`, `schema`) run the task everywhere.

## Google authentication

1. In the [Google Cloud console](https://console.cloud.google.com/apis/credentials) create an
   *OAuth client ID* of type *Web application*.
2. Authorized redirect URIs — **both** are required (plus the production equivalents):
   - `http://localhost:8007/accounts/google/login/callback/` — allauth, used for the Django admin
   - `http://localhost:3007/api/auth/callback/google` — NextAuth, used by the frontend

   Authorized JavaScript origin: `http://localhost:3007`.
3. Put the credentials in `backend/.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, and in
   `frontend/.env.local` as `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`. They must be the same client:
   allauth validates the Google ID token's audience against its own configured client id.

Credentials are read from the environment, **not** from a `SocialApp` row in the admin — configuring
both raises `MultipleObjectsReturned`.

## How the frontend authenticates

The frontend never uses session cookies against the API. It obtains a Google ID token and trades it
for our own JWT pair, then sends the access token as a bearer token.

```
# 1. exchange a Google ID token for our tokens
POST /_allauth/app/v1/auth/provider/token
{ "provider": "google", "process": "login",
  "token": { "client_id": "<google client id>", "id_token": "<google id token>" } }

-> { "data": { "user": {...} },
     "meta": { "access_token": "<jwt>", "refresh_token": "<jwt>",
               "token_type": "Bearer", "expires_in": 900 } }

# 2. call the API
GET /api/v1/auth/me
Authorization: Bearer <access token>

# 3. refresh when the access token expires (the pair is rotated)
POST /_allauth/app/v1/tokens/refresh
{ "refresh_token": "<jwt>" }
-> { "data": { "access_token": "<jwt>", "refresh_token": "<jwt>" } }
```

Access tokens live 15 minutes, refresh tokens 14 days (`JWT_*_LIFETIME`, in seconds). Tokens are
stateless — there is no denylist, so deactivating a user (rather than revoking a token) is what cuts
access, at the next request. Signing uses `JWT_SIGNING_KEY`, falling back to `SECRET_KEY`.

A browser redirect flow (`/_allauth/app/v1/auth/provider/redirect`) and the server-rendered
`/accounts/` views are also available; the latter is how you sign into the Django admin with Google.

Email/password and magic-link login are deliberately switched off for now
(`SOCIALACCOUNT_ONLY = True` in `config/settings/base.py`); allauth already ships both, so enabling
them later is a settings change plus frontend work.

## Adding an endpoint

Create a router in your app (see `apps/core/api.py`), register it in `config/api.py`, and pick an
auth scheme per route: none, `auth=JWTAuth()` for user tokens, or `auth=APIKeyAuth()`
(`ninja_apikey.security`) for service-to-service keys managed in the admin.

## OpenAPI schema for the frontend

`backend/openapi.json` is committed and is what Orval generates the TypeScript client into
`frontend/src/lib/api/generated/`, so the frontend build never needs a running backend. Both
artifacts are committed and both are staleness-checked in CI, which together make "changed a schema
and forgot the client" unmergeable.

`make schema` regenerates the pair. Every ninja route gets its operation id from the view function
name (see `RedactionAPI` in `config/api.py`), which is what turns `def get_me` into a `useGetMe()`
hook — so view names must stay unique across the API, and `tests/test_openapi_schema.py` enforces
that.

## Tests

`make test` runs pytest against Postgres (`config.settings.test`) and vitest for the frontend.
`make lint`, `make fmt` and `make check` likewise run across both components; the `backend-*` and
`frontend-*` targets do one at a time. CI additionally checks formatting, lints, verifies there are
no missing migrations, checks both generated artifacts are current, and builds both Docker images.
