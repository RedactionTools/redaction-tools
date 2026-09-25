type SearchParams = Record<string, string | string[] | undefined>

export type BenchmarkParams = { revision?: string; scope: 'all' | 'verified' }

/**
 * A benchmark page's query string, as the params object its query key is built from.
 *
 * The page prefetches with this object and the client component reads with the same
 * one, so they must agree exactly - which is why an absent revision is left out rather
 * than set to undefined, and why an unknown scope falls back rather than reaching the
 * API as a 422.
 */
export function parseBenchmarkParams(searchParams: SearchParams): BenchmarkParams {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  const revision = first(searchParams.revision)
  const scope = first(searchParams.scope) === 'verified' ? 'verified' : 'all'
  return revision ? { revision, scope } : { scope }
}
