import type { ListToolsParams } from '@/lib/api/generated/model'

/** Facet dimensions the hub filters on, in the order the filter bar shows them. */
export const FACET_DIMENSIONS = [
  'media',
  'deployment',
  'method',
  'pricing_model',
  'compliance',
  'platform',
  'capability',
  'audience',
] as const

export type FacetDimension = (typeof FACET_DIMENSIONS)[number]

const ORDERINGS = ['price', '-price', 'name', '-name', 'verified'] as const

export type CatalogFilters = Omit<ListToolsParams, 'page_size'>

type RawSearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  return raw?.trim() || undefined
}

/**
 * Read the hub's filters off the URL, discarding anything unrecognised.
 *
 * Allow-listed rather than passed through: these values reach the API as query
 * parameters, and forwarding arbitrary keys would let a crafted link probe it.
 */
export function parseToolFilters(searchParams: RawSearchParams): CatalogFilters {
  const filters: CatalogFilters = {}

  for (const dimension of FACET_DIMENSIONS) {
    const value = first(searchParams[dimension])
    if (value) filters[dimension] = value
  }

  const query = first(searchParams.q)
  if (query) filters.q = query

  const ordering = first(searchParams.ordering)
  if (ordering && (ORDERINGS as readonly string[]).includes(ordering)) filters.ordering = ordering

  const freeTier = first(searchParams.has_free_tier)
  if (freeTier === 'true') filters.has_free_tier = true

  const page = Number(first(searchParams.page))
  if (Number.isInteger(page) && page > 1) filters.page = page

  return filters
}

/**
 * Whether this view is a narrowed one.
 *
 * Ordering deliberately does not count: the same set of tools in a different
 * order is the same page, so `?ordering=name` stays indexable while
 * `?media=video` does not.
 */
export function hasActiveFilters(filters: CatalogFilters): boolean {
  return (
    FACET_DIMENSIONS.some((dimension) => filters[dimension]) ||
    Boolean(filters.q) ||
    Boolean(filters.has_free_tier)
  )
}

/**
 * How many boxes are ticked.
 *
 * Counted per value rather than per dimension, because that is what the reader
 * ticked. The search term is left out: it has its own visible box beside the
 * filters, so counting it here would report it twice.
 */
export function activeFacetCount(filters: CatalogFilters): number {
  const facets = FACET_DIMENSIONS.reduce(
    (total, dimension) => total + (filters[dimension] ?? '').split(',').filter(Boolean).length,
    0,
  )
  return facets + (filters.has_free_tier ? 1 : 0)
}

/**
 * Drop the page number.
 *
 * Any change to what is being filtered invalidates where you were in the
 * results: page 3 of the previous filter means nothing under the new one.
 */
export function resetPage(filters: CatalogFilters): CatalogFilters {
  const next = { ...filters }
  delete next.page
  return next
}

/** Add or remove one facet value. Values within a dimension are an OR. */
export function toggleFacet(
  filters: CatalogFilters,
  dimension: FacetDimension,
  code: string,
): CatalogFilters {
  const current = (filters[dimension] ?? '').split(',').filter(Boolean)
  const next = current.includes(code)
    ? current.filter((value) => value !== code)
    : [...current, code]

  return { ...resetPage(filters), [dimension]: next.length ? next.join(',') : undefined }
}

/** Serialise filters back to a query string, key-sorted so URLs are stable. */
export function toQueryString(filters: CatalogFilters): string {
  const params = new URLSearchParams()
  for (const key of Object.keys(filters).sort()) {
    const value = filters[key as keyof CatalogFilters]
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  return params.toString()
}
