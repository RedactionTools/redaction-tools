'use client'

import { usePathname, useRouter } from 'next/navigation'

import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useListFacets } from '@/lib/api/generated/catalog/catalog'
import {
  FACET_DIMENSIONS,
  type CatalogFilters,
  type FacetDimension,
  resetPage,
  toQueryString,
  toggleFacet,
} from '@/lib/catalog/filters'

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

  return (
    <div className="space-y-6">
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
              <label key={value.code} className="flex items-center gap-2 text-sm">
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
        <label className="flex items-center gap-2 text-sm">
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
  )
}
