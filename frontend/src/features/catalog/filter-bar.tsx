'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useListFacets } from '@/lib/api/generated/catalog/catalog'
import {
  FACET_DIMENSIONS,
  type CatalogFilters,
  type FacetDimension,
  activeFacetCount,
  resetPage,
  toQueryString,
  toggleFacet,
} from '@/lib/catalog/filters'
import { cn } from '@/lib/utils'

/**
 * The hub's filters.
 *
 * Filtering happens on the server: this writes the URL and the server component
 * re-renders with the new `searchParams`. One source of truth, and a filtered
 * URL is a real page whose HTML matches what it claims.
 */
export function FilterBar({ filters }: { filters: CatalogFilters }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data, isPending } = useListFacets()
  const [open, setOpen] = useState(false)

  function go(next: CatalogFilters) {
    const query = toQueryString(next)
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  if (isPending || !data) {
    return <Skeleton className="h-64 w-full" data-testid="filter-bar-skeleton" />
  }

  const byCode = new Map(data.map((dimension) => [dimension.code, dimension]))
  const selected = (dimension: FacetDimension) =>
    new Set((filters[dimension] ?? '').split(',').filter(Boolean))

  const appliedCount = activeFacetCount(filters)

  return (
    <div className="space-y-3">
      {/* `aria-expanded` is false at every width here, including the widths
          where the panel is open regardless - but the control is `md:hidden`,
          so at those widths it is not in the accessibility tree to be wrong
          in. Do not "fix" it by syncing it to the breakpoint: CSS is not
          readable from here. */}
      <button
        type="button"
        aria-controls="catalog-filters"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="border-border hover:bg-muted flex min-h-11 w-full items-center justify-between gap-2 rounded-md border px-3 text-sm font-medium md:hidden"
      >
        Filters
        {appliedCount ? (
          <span className="bg-muted rounded-full px-2 py-0.5 text-xs tabular-nums">
            {appliedCount}
          </span>
        ) : null}
      </button>

      <div id="catalog-filters" className={cn('space-y-6', !open && 'max-md:hidden')}>
        {FACET_DIMENSIONS.map((code) => {
          const dimension = byCode.get(code)
          if (!dimension) return null

          // A facet that would match nothing is a dead end, not a filter.
          const values = dimension.values.filter((value) => value.tool_count > 0)
          if (values.length === 0) return null

          const applied = selected(code)
          return (
            <fieldset key={code} className="space-y-2">
              <legend className="mb-2 text-sm font-medium">{dimension.label}</legend>
              {values.map((value) => (
                <label key={value.code} className="flex items-center gap-2 py-1 text-sm">
                  <Checkbox
                    checked={applied.has(value.code)}
                    onChange={() => go(toggleFacet(filters, code, value.code))}
                  />
                  <span className="flex-1">{value.label}</span>
                  <span className="text-muted-foreground tabular-nums">{value.tool_count}</span>
                </label>
              ))}
            </fieldset>
          )
        })}

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Pricing</legend>
          <label className="flex items-center gap-2 py-1 text-sm">
            <Checkbox
              checked={Boolean(filters.has_free_tier)}
              onChange={() => {
                const next = resetPage(filters)
                delete next.has_free_tier
                go(filters.has_free_tier ? next : { ...next, has_free_tier: true })
              }}
            />
            <span>Has a free tier</span>
          </label>
        </fieldset>
      </div>
    </div>
  )
}
