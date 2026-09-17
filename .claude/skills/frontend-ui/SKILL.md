---
name: frontend-ui
description: Build or change UI in the Next.js frontend - components, pages, styling, data fetching and component tests. Use when adding a page or component, wiring a component to API data, working with Tailwind tokens or dark mode, or writing vitest/Testing Library tests.
---

# Building UI

Read `frontend/CLAUDE.md` first for the layout and the hard rules. This covers
how to actually build a piece.

## Where things go

- `src/components/ui/` — neutral primitives (`Button`, `Card`, `Badge`,
  `Skeleton`). They may import `lib/utils` and `radix-ui` only. No data, no
  feature knowledge.
- `src/components/layout/` — chrome (header, footer, container).
- `src/features/<domain>/` — components that fetch. These compose `ui`
  primitives and call generated hooks.
- `src/app/**/page.tsx` — routing, auth guards and prefetch. Keep them thin.

## A primitive

Wrap radix once, style with Tailwind, expose variants with `cva`, and support
`asChild` via `Slot.Root` where composition matters:

```tsx
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
```

Write plain `ref` props — React 19 passes `ref` as a normal prop and
`forwardRef` is deprecated. Merge classes with `cn()` so callers can override.

## A data-bound component

```tsx
'use client'
import { useGetMe } from '@/lib/api/generated/auth/auth'

export function AccountCard() {
  const { data, isPending } = useGetMe()
  if (isPending) return <Skeleton className="h-5 w-40" />
  return <Card>{data?.email}</Card>
}
```

It takes **no props** — the page prefetches into the same query key and the hook
reads from cache, so first paint is populated. Never prop-drill fetched data.

## A page that needs data

Prefetch on the server, hydrate on the client. This is the pattern to follow
even for one field, because it is what the catalog and leaderboard will need:

```tsx
const queryClient = getQueryClient()
await queryClient.prefetchQuery(getGetMeQueryOptions())
return (
  <HydrationBoundary state={dehydrate(queryClient)}>
    <AccountCard />
  </HydrationBoundary>
)
```

Guard protected pages with `const session = await auth()` and redirect when
absent or `session.error` is set.

## Styling

Tailwind v4, CSS-first. Tokens are in the `@theme` block of
`src/app/globals.css`; `@theme` only generates utility *names*, while `:root`
and `.dark` carry the values — so add a token in both places. Dark mode uses the
explicit `@custom-variant` already declared there.

Visual design is deliberately deferred: the palette is neutral placeholders.
Don't invent an aesthetic without asking. Most Tailwind guidance online is v3
and will suggest a `tailwind.config.js` that v4 ignores.

## Tests

```tsx
const queryClient = makeTestQueryClient()
queryClient.setQueryData(getGetMeQueryKey(), fixture)
renderWithProviders(<AccountCard />, { queryClient })
expect(screen.getByText('user@example.com')).toBeInTheDocument()
```

Seed the cache; do not mock fetch for component tests. Assert on what the user
sees. If a query is ambiguous (`getByText('ok')` matching two fields), add a
`data-testid` to the component rather than loosening the assertion.

Pure logic goes in `*.test.ts` with `vi.spyOn(globalThis, 'fetch')` and exact
request assertions. Write the failing test first, one at a time.
