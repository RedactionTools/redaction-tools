---
name: api-contract
description: Add or change a backend API endpoint and propagate it to the typed frontend client. Use when adding/editing a django-ninja route or schema, when frontend types are missing or stale, when a generated hook has an unexpected name, or when CI fails the openapi.json / generated-client staleness check.
---

# Changing the API contract

The chain is **Python routers → `backend/openapi.json` → `frontend/src/lib/api/generated/`**.
All three are committed and CI verifies the last two are current, so an endpoint
change is never done until both generated artifacts are regenerated.

## The loop

1. **Write the failing test first**, in `backend/tests/`. Hit the literal path
   (`client.get("/api/v1/...")`); `conftest.py` supplies `user`, `client` and
   `bearer` fixtures.
2. **Add the route** in the app's `api.py`, and register the router in
   `config/api.py` if it is new.
   - Pick `auth=`: omit for public, `auth=JWTAuth()` for a user bearer token, or
     `auth=APIKeyAuth()` (`ninja_apikey.security`) for a service key.
   - **The view function name becomes the operation id**, which becomes the hook
     name. `def get_me` → `useGetMe()`. Name the view for the hook you want, and
     keep it unique across the whole API.
3. `make backend-test` until green.
4. **`make schema`** — regenerates `backend/openapi.json` *and* the Orval client.
5. `make frontend-lint` to typecheck the new client.
6. **Commit both generated artifacts** with the source change.

## Naming

Operation ids come from `RedactionAPI.get_openapi_operation_id` in
`backend/config/api.py`, which overrides ninja's dotted-path default
(`apps_accounts_api_me`). A collision between two view names would silently
produce a wrong hook name, so `backend/tests/test_openapi_schema.py` asserts
uniqueness — keep that test passing rather than working around it.

Pass `operation_id="..."` on a route only to resolve a genuine collision.

## Gotchas

- **Error responses are not in the spec.** Ninja only documents the success
  shape, so Orval types `TError` as `unknown`. The frontend fixes this globally
  by registering `ApiError` in `src/types/react-query.d.ts` — don't add per-hook
  casts. To document a real error shape, declare
  `response={200: Out, 404: ErrorSchema}` on the route.
- **`servers` is empty and paths are fully prefixed** (`/api/v1/...`). The
  generated client emits relative URLs and the mutator prepends the origin. Do
  not set `baseUrl` in `orval.config.ts` — it would bake the origin into query
  keys.
- **GET routes must generate queries, not mutations.** If you see
  `getXMutationOptions` for a GET, something set `query.useMutation` in
  `orval.config.ts`.
- **Never hand-edit** `openapi.json` or `src/lib/api/generated/` — the next
  `make schema` overwrites it and CI catches the drift.
- A degraded-but-reachable state (like `/health`) is reported **in the body with
  a 200**, not as a 5xx. Branch on the field, not the status code.
