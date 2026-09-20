import { cache } from 'react'

import { ApiError } from '@/lib/api/api-error'
import { getTool, listTools } from '@/lib/api/generated/catalog/catalog'
import type { ToolDetailOut, ToolListItemOut } from '@/lib/api/generated/model'
import { collectPages } from '@/lib/catalog/paging'

/** The API's own ceiling on a page, from `MAX_PAGE_SIZE` in the catalog router. */
const MAX_PAGE_SIZE = 100

/**
 * Fetch one tool for a server render, or null when it is not a page.
 *
 * Wrapped in React's `cache` so `generateMetadata`, the page body and the OG
 * image share one request: the fetch mutator sets `cache: 'no-store'`, so
 * Next's own deduplication does not apply.
 */
export const fetchTool = cache(async (slug: string): Promise<ToolDetailOut | null> => {
  try {
    return await getTool(slug)
  } catch (error) {
    // 404 is the API saying "not listable", which is a real answer, not a fault.
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
})

/**
 * Every listable tool, for the routes read by machines rather than people.
 *
 * Note the deliberate contrast with `fetchTool`, which rethrows anything that
 * is not a 404: a tool page that silently renders empty is worse than a 500.
 * Here the reverse holds. `sitemap.xml`, `llms.txt` and `llms-full.txt` are
 * fetched by crawlers, and serving them a 500 during a backend blip is the more
 * expensive failure - so they degrade to the static routes alone. The swallow
 * lives here, once, so all three degrade identically.
 */
export async function fetchAllTools(): Promise<ToolListItemOut[]> {
  try {
    return await collectPages((page) => listTools({ page, page_size: MAX_PAGE_SIZE }), {
      pageSize: MAX_PAGE_SIZE,
    })
  } catch {
    return []
  }
}
