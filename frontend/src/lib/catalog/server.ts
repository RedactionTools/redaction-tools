import { cache } from 'react'

import { ApiError } from '@/lib/api/api-error'
import { getTool } from '@/lib/api/generated/catalog/catalog'
import type { ToolDetailOut } from '@/lib/api/generated/model'

/**
 * Fetch one tool for a server render, or null when it is not a page.
 *
 * Wrapped in React's `cache` so `generateMetadata` and the page body share one
 * request: the fetch mutator sets `cache: 'no-store'`, so Next's own
 * deduplication does not apply.
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
