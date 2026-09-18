# Development

Everything needed to run `redaction-tools` locally and change it safely. For what the product
is, see [`README.md`](README.md).

## Stack

| Area | Choice |
| --- | --- |
| Framework | Django 6.1 (Python 3.13) |
| API | django-ninja (`/api/v1/`), OpenAPI at `/api/v1/docs` |
| Auth | django-allauth headless + Google, issuing our own JWTs |
| Admin | django-unfold |
| Background jobs | django-q2 (ORM broker) |
| Staff MCP server | django-mcpz (`/mcp`), OAuth at `/oauth/` |
| Database | PostgreSQL 17 |
| Tooling | uv, ruff, pytest, pre-commit, make |
| Frontend | Next.js 16 (App Router), React 19, Tailwind v4, TanStack Query, Orval, NextAuth |
| Frontend tooling | bun, vitest, ESLint, Prettier |
| Deploy | Docker Compose, GitHub Actions CI |

## Layout

```
backend/            Django project
  config/           settings (base/local/production/test), urls, api, mcp, wsgi/asgi
  apps/core/        shared base models + /health
  apps/accounts/    user model, JWT, allauth glue, admin, MCP auth
  apps/catalog/     the catalog: models, API, filters, admin, seed migrations
                    staff.py (staff writes) + mcp.py (the MCP tool surface)
  tests/
  openapi.json      committed schema; the Orval input
frontend/           Next.js app
  src/app/          routes: (site) chrome, tool/[slug], submit, methodology, auth/
  src/lib/api/      generated/ (Orval) + the fetch mutator and token source
  src/lib/auth/     framework-free token logic (exchange, refresh, expiry)
  src/lib/catalog/  filter parsing, price formatting, sitemap entries
  src/lib/seo/      JSON-LD builders
  src/features/     components that fetch data
  src/components/   ui/ primitives, layout chrome, providers
docker-compose.yml  db + backend + qcluster + frontend
Makefile            make help
```

## Getting started

```bash
cp .env.example .env                       # compose settings — set SECRET_KEY and AUTH_SECRET
cp backend/.env.example backend/.env       # local Django settings — set SECRET_KEY
cp frontend/.env.example frontend/.env.local
make up                                    # start Postgres
make install                               # uv sync + bun install + git hooks
make backend-migrate                       # also seeds the catalog
make backend-superuser
make backend                               # http://localhost:8007
make frontend                              # http://localhost:3007
```

Or run everything in Docker: `make stack`.

Ports are 8007 (backend) and 3007 (frontend), overridable with `BACKEND_PORT` / `FRONTEND_PORT`.

Useful URLs: `/admin/`, `/api/v1/docs`, `/api/v1/health`, `/_allauth/openapi.html` (local only).

`make help` lists every target. They are namespaced per component — `make backend`,
`make backend-test`, `make frontend-lint` — and the unprefixed aggregates (`make test`, `lint`,
`fmt`, `check`, `schema`) run the task everywhere.

The catalog arrives with the migrations: `make backend-migrate` seeds the taxonomy, seven tools
with vetted prices, and their editorial. The seeds are idempotent and guarded by an existence
check, so re-running `migrate` is a no-op.

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

Then run `make schema` and commit both generated artifacts with the change.

## The staff MCP server

`/mcp` is a Model Context Protocol server that lets a staff user read and edit the catalog from
Claude: list listings, read one, edit it, edit its plans, publish a price. It is a plain
synchronous Django view (django-mcpz), so it runs inside the existing gunicorn/WSGI process with
no extra service.

Three layers, and the split is the point:

| File | Holds |
| --- | --- |
| `config/mcp.py` | the server object and its instructions; a manifest, no logic |
| `apps/catalog/mcp.py` | msgspec parameter and result types, one per tool |
| `apps/catalog/staff.py` | the rules — no MCP, no ninja, no `request` |

**It is outside the schema pipeline.** `make backend-schema` exports `config.api.api` only, so
nothing here reaches `openapi.json` or the generated frontend client, and `make schema` must
produce no diff when you change a tool.

Two credentials, one gate (`apps/accounts/mcp_auth.py`): OAuth is what claude.ai's connector flow
mints, a static bearer token is what a terminal uses. Both end at `is_staff` — a valid credential
for a non-staff account gets 403, not 401, so a connector does not loop trying to re-authorise.

### Using it from a terminal

```bash
make backend-mcp-token EMAIL=you@example.com    # printed once; only the digest is stored
claude mcp add --transport http --header "Authorization: Bearer mcp_..." \
  redaction-tools http://localhost:8007/mcp
```

Or point the MCP Inspector (`npx @modelcontextprotocol/inspector`) at
`http://localhost:8007/mcp` over Streamable HTTP with the same header.

### Using it from claude.ai

Add a custom connector pointing at `https://backend.redaction-tools.com/mcp`. Claude registers
itself at `/oauth/register` and sends you to `/oauth/authorize`, which bounces an anonymous browser
through `/accounts/login/` to Google and back to the consent page. `SOCIALACCOUNT_ONLY = True`, so
Google is the only way in — the account needs `is_staff` **and** a linked `SocialAccount`.

### Adding a tool

Add the msgspec types and the `@server.tool` in `apps/catalog/mcp.py`, and put the rules in
`apps/catalog/staff.py`, raising `StaffError` for anything the caller can fix by trying again
differently — the MCP layer turns that into an in-band `isError` result the model self-corrects
from. Every write carries `permission=is_staff` and takes `user` explicitly, so nothing writes a
price or a revision without recording who did it.

Two things that bite:

- Fields a caller may omit are `msgspec.UNSET`, not `None`. A numeric constraint has to sit on the
  inner type — `Annotated[int, Meta(ge=0)] | UnsetType`, never `Annotated[int | UnsetType, ...]`,
  which msgspec rejects at import.
- After installing, the first test run needs `--create-db`: `--reuse-db` is in `addopts` and a
  cached test database has no `django_mcpz_*` tables.

## OpenAPI schema for the frontend

`backend/openapi.json` is committed and is what Orval generates the TypeScript client into
`frontend/src/lib/api/generated/`, so the frontend build never needs a running backend. Both
artifacts are committed and both are staleness-checked in CI, which together make "changed a schema
and forgot the client" unmergeable.

`make schema` regenerates the pair. Every ninja route gets its operation id from the view function
name (see `RedactionAPI` in `config/api.py`), which is what turns `def get_me` into a `useGetMe()`
hook — so view names must stay unique across the API, and `tests/test_openapi_schema.py` enforces
that.

`orval.config.ts` sets neither `useQuery` nor `useMutation` on purpose. Neither is a verb filter —
each applies to *every* operation, so setting one gives POSTs query hooks (firing a write on
render) or GETs mutation hooks. Left alone, orval splits by HTTP verb.

## Tool logos

`Tool.logo_url` holds a site-relative path (preferred) or an absolute URL. Logos are **re-hosted,
never hotlinked**: drop the file into `frontend/public/images/tools/` at the path the listing
records — `/images/tools/adobe-acrobat.svg` and so on — and it appears with no code change.

Until a file is there, the listing renders a monogram of the tool's initials. A broken image in a
comparison table reads as a broken site; a monogram reads as a tool whose logo we have not added
yet, which is the truth.

Two things `ToolLogo` handles that a bare `<img>` would not. Most vendor logos are wordmarks
rather than square icons (Redactable's is 6.7:1), so the image is height-constrained with a width
cap instead of being boxed into a square. And several are near-black — Nitro is `#090B21` — so
every logo sits on a light plate, which keeps them legible on the dark theme without recolouring
anyone's mark.

`backend/tests/test_catalog_seed.py` asserts every recorded path resolves to a file that exists,
so a missing or misspelled logo fails the suite rather than appearing as a broken image.

## Rendering and the API-down build

Catalog routes and `sitemap.ts` declare `export const dynamic = 'force-dynamic'`. The frontend
Docker image is built with no backend reachable (see `.github/workflows/ci.yml`), so anything
prerendered would bake an empty catalog into the bundle — or fail the build outright. The
regression worth keeping:

```bash
docker compose stop backend
cd frontend && bun run build
docker compose start backend
```

## Tests

`make test` runs pytest against Postgres (`config.settings.test`) and vitest for the frontend.
`make lint`, `make fmt` and `make check` likewise run across both components; the `backend-*` and
`frontend-*` targets do one at a time. CI additionally checks formatting, lints, verifies there are
no missing migrations, checks both generated artifacts are current, and builds both Docker images.

Tests come first here — the repo carries tdd-guard's rulebook in `.claude/tdd-guard/data/`. One
failing test at a time, then the minimal code to pass it.

Two things about the backend suite that surprise people:

- **The seed migrations run in every test database**, so seven tools exist before your test does.
  A test asserting "the catalog is empty" will not hold; scope assertions to the rows you created.
- **Model field validators do not run on `save()`.** Django only calls them from `full_clean()`,
  which the admin does and the ORM does not — so the API boundary validates user-supplied URLs
  itself, in `apps/catalog/services.py`.
