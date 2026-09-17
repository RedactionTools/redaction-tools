---
name: auth-flow
description: Understand and debug sign-in for redaction-tools - the Google to allauth to JWT handshake, token refresh and rotation, and 401s. Use when touching NextAuth config, the token exchange or refresh logic, protected routes, or when sign-in fails, sessions drop, or API calls return 401.
---

# How authentication works

Google → NextAuth → **allauth headless** → our own JWT pair → bearer token on
`/api/v1/*`. The frontend never sends session cookies to the API.

## The handshake

```
1. NextAuth completes Google OAuth and receives an id_token.
2. POST /_allauth/app/v1/auth/provider/token
   { provider: "google", process: "login",
     token: { client_id: <google client id>, id_token: <id token> } }
   -> { data: { user }, meta: { access_token, refresh_token, expires_in: 900 } }
3. The pair is stored in the NextAuth JWT cookie.
4. GET /api/v1/auth/me with `Authorization: Bearer <access>`
5. On expiry: POST /_allauth/app/v1/tokens/refresh { refresh_token }
   -> { data: { access_token, refresh_token } }   <- BOTH are new
```

Access tokens live 15 minutes, refresh tokens 14 days. Tokens are stateless
HS256 with **no denylist**, so deactivating a user (not revoking a token) is
what cuts access, at the next request.

## Where the code lives

| Concern | File |
| --- | --- |
| Decision tree (exchange / reuse / refresh / fail) | `frontend/src/lib/auth/resolve-token.ts` |
| allauth HTTP calls + zod schemas | `frontend/src/lib/auth/allauth.ts` |
| Expiry arithmetic and skew | `frontend/src/lib/auth/tokens.ts` |
| Unverified `exp` decode | `frontend/src/lib/auth/jwt.ts` |
| NextAuth wiring only | `frontend/src/auth.ts` |
| Token → mutator plumbing | `frontend/src/lib/api/token-source*.ts` |
| Backend verification | `backend/apps/accounts/jwt.py`, `api.py`, `tokens.py` |

Keep logic in `lib/auth/*` and wiring in `auth.ts`. next-auth is a pinned beta
(`5.0.0-beta.32`); that separation is what makes a version bump cheap.

## Failures that actually happen

- **`redirect_uri_mismatch`** — the Google client needs **two** redirect URIs:
  `http://localhost:8007/accounts/google/login/callback/` (allauth, for the
  Django admin) and `http://localhost:3007/api/auth/callback/google` (NextAuth).
  Both must be registered, and the JS origin must be `http://localhost:3007`.
- **`MultipleObjectsReturned`** — credentials are configured **both** in env vars
  and as a `SocialApp` row in the admin. Delete the row; env wins by design.
- **Audience mismatch on exchange** — `AUTH_GOOGLE_ID` (frontend) and
  `GOOGLE_CLIENT_ID` (backend) must be the *same* Google client; allauth
  validates the ID token's audience.
- **400 from `/tokens/refresh`** — the refresh token was already rotated away,
  or expired. `resolveAuthToken` clears both tokens and sets
  `error: 'RefreshTokenError'` so the UI forces a re-login. Do not retry.
- **Refresh runs on every render** — `proxy.ts` is missing or renamed. `auth()`
  in a Server Component cannot write cookies, so rotation is computed and never
  persisted. Next 16 uses `src/proxy.ts`; a `middleware.ts` is silently ignored.
- **401 on `/api/v1/auth/me` with a token** — a *refresh* token was sent instead
  of an access token; the backend requires `typ: "access"`.
- **Signed in but API calls are unauthenticated** — the token source for that
  runtime was never registered. The server one is imported in
  `src/app/layout.tsx`, the client one in `components/providers/providers.tsx`.

## Currently disabled on purpose

`SOCIALACCOUNT_ONLY = True` in `backend/config/settings/base.py` disables
email/password and magic-link login. Routes allauth reserves for them
(`/auth/signup`, `/auth/password/reset*`, `/auth/verify-email/*`) are therefore
unreachable and intentionally not built — add them in the same change that flips
that setting.

## Testing it

`backend/tests/test_headless_auth.py`, `test_auth_api.py`, `test_jwt.py` cover
the backend contract. On the frontend, `resolve-token.test.ts` covers every
branch with injected fakes — add a case there rather than reaching for an
end-to-end test.
