'use client'

import { usePathname, useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type CatalogFilters, resetPage, toQueryString } from '@/lib/catalog/filters'

/**
 * Search, submitted rather than debounced.
 *
 * Filtering is a server round trip, so firing one per keystroke would queue
 * renders the reader never asked for. A form also means the control still works
 * before hydration.
 */
export function ToolSearch({ filters }: { filters: CatalogFilters }) {
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(filters.q ?? '')

  return (
    <form
      role="search"
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        const query = toQueryString({ ...resetPage(filters), q: value.trim() || undefined })
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST) {
          posthog.capture('catalog_search_submitted', { has_query: Boolean(value.trim()) })
        }
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
      }}
    >
      <Input
        type="search"
        name="q"
        aria-label="Search redaction tools"
        placeholder="Search tools, vendors or capabilities"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <Button type="submit">Search</Button>
    </form>
  )
}
