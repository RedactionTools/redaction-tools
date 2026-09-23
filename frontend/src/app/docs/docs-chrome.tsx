'use client'

import { SearchTrigger } from 'fumadocs-ui/layouts/shared/slots/search-trigger'

/**
 * The header's search button on /docs.
 *
 * Its own file, and client-only, because `SiteHeader` renders on every page and
 * must not pull fumadocs into the bundle of pages that have no search. The
 * trigger reads `useSearchContext()`, whose default is `{ enabled: false }`, so
 * `hideIfDisabled` renders nothing at all outside `RootProvider`.
 */
export function DocsSearchTrigger() {
  return <SearchTrigger hideIfDisabled />
}
