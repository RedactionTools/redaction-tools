'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { analytics } from '@/lib/analytics'
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
        analytics.capture('catalog_search_submitted', { has_query: Boolean(value.trim()) })
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
      }}
    >
      <div className="relative flex-1">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
        >
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="m13 13 4 4" />
        </svg>
        <Input
          className="shadow-surface h-11 rounded-lg pl-10"
          type="search"
          name="q"
          aria-label="Search redaction tools"
          placeholder="Search tools, vendors or capabilities"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      <Button type="submit" className="h-11 rounded-lg px-5">
        Search
      </Button>
    </form>
  )
}
