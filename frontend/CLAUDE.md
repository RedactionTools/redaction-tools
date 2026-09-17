# frontend

Next.js 16 (App Router) + React 19 + TypeScript, package-managed by bun.

## Commands

Prefer the repo-root `make frontend-*` targets. Directly: `bun run dev`,
`test`, `test:watch`, `lint`, `format`, `typecheck`, `api:generate`.

**bun only** — never npm/yarn/pnpm. The lockfile is `bun.lock` and CI installs
with `--frozen-lockfile`. Note bun is the package manager and script runner,
but Next itself runs on Node; do not use `bun --bun next dev`.

## Layout

- `src/app/` — routes. `(site)` is the chrome group; `auth/` is a **literal**
  segment because the backend's `HEADLESS_FRONTEND_URLS` hardcodes `/auth/...`.
- `src/lib/api/` — `generated/` is Orval output (read-only). Its siblings
  `fetcher.ts`, `token-source*.ts`, `base-url.ts` are hand-written.
- `src/lib/auth/` — framework-free token logic. Keep it free of next-auth
  imports: `src/auth.ts` is the only wiring, which is what makes the logic
  testable and survivable across next-auth beta churn.
- `src/features/<domain>/` — components that fetch data.
- `src/components/ui/` — neutral primitives; they may import `lib/utils` and
  `radix-ui` only, never `lib/api` or `auth`.

## Rules

- **Server Components by default.** Add `'use client'` only where interactivity
  or a hook requires it.
- **Fetch through the generated hooks** (`useHealth()`, `useGetMe()`), never a
  bare `fetch` to the API. They route through the mutator, which attaches the
  bearer token for whichever runtime is executing.
- **Tailwind v4 is CSS-first** — there is no `tailwind.config.js`. Design tokens
  live in the `@theme` block in `src/app/globals.css`; the `:root` / `.dark`
  blocks below it carry the actual values. Dark mode uses an explicit
  `@custom-variant`, because v4 dropped `darkMode: 'class'`.
- **Middleware is `src/proxy.ts`**, not `middleware.ts`. Next 16 renamed it and
  silently ignores the old name — auth would stop running with no error.

## State boundaries

- **TanStack Query** owns anything that lives on the server, keyed by the
  generated `getXQueryKey()`. Never copy that data into another store.
- **`useState`** owns single-component interaction state.
- **zustand** is for client-only state that is genuinely global and not
  derivable. That set is currently empty — do not invent a store.
- **Auth** is none of these: `useSession()` on the client, `auth()` on the
  server.
- **zod** validates untyped boundaries only: `lib/env.ts`, the allauth responses
  in `lib/auth/allauth.ts` (not in the OpenAPI spec), and form input. It must
  **not** re-validate `/api/v1/*` responses — Orval already types those, and a
  second source of truth drifts.

## Tests

vitest + Testing Library, jsdom, colocated as `*.test.ts(x)`.

- `*.test.ts` — pure logic, no DOM. Stub the network with
  `vi.spyOn(globalThis, 'fetch')` and assert on the exact request.
- `*.test.tsx` — component behaviour. Render via `src/test/render.tsx` and seed
  data with `queryClient.setQueryData(getXQueryKey(), fixture)` rather than
  mocking fetch. Assert on what the user sees.
- Don't test generated code or page components.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
