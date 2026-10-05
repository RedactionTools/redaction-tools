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

/**
 * A link to a benchmark page that names its revision only when it has to.
 *
 * Every page without `?revision=` already shows the current revision, and a page
 * that names one is noindexed as a slice of it. So linking the current revision by
 * name sends crawlers to the noindexed copy and leaves the canonical page unlinked.
 */
export function benchmarkHref(
  path: string,
  {
    revision,
    isCurrent,
    scope = 'all',
  }: { revision: string; isCurrent: boolean; scope?: BenchmarkParams['scope'] },
): string {
  const query = new URLSearchParams()
  if (!isCurrent) query.set('revision', revision)
  if (scope === 'verified') query.set('scope', scope)
  const search = query.toString()
  return search ? `${path}?${search}` : path
}

/**
 * Whether a page is a slice of its canonical one, and so followed but not indexed:
 * a superseded revision, or the verified-only view. Naming the current revision is
 * not a slice - it is the same page, and the canonical says so.
 */
export function isAlternateView(params: BenchmarkParams, revisionIsCurrent: boolean): boolean {
  return (Boolean(params.revision) && !revisionIsCurrent) || params.scope !== 'all'
}
