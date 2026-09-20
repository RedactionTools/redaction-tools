/** One page of a paginated list endpoint: the window, and the size of the whole. */
export interface Page<T> {
  count: number
  items: T[]
}

/**
 * Walk a paginated endpoint to the end and return everything.
 *
 * `maxPages` is not a formality. The callers are `sitemap.xml`, `llms.txt` and
 * `llms-full.txt` - public, uncacheable and fetched by robots - so a `count`
 * the API cannot actually serve has to end the loop rather than run it forever.
 * At the default it covers 2,000 tools; past that the answer is a sitemap
 * index, not a larger number here.
 */
export async function collectPages<T>(
  fetchPage: (page: number) => Promise<Page<T>>,
  { pageSize, maxPages = 20 }: { pageSize: number; maxPages?: number },
): Promise<T[]> {
  const collected: T[] = []

  for (let page = 1; page <= maxPages; page++) {
    const { count, items } = await fetchPage(page)
    collected.push(...items)

    // A short or empty page is the end of the list whatever the count claims.
    if (items.length < pageSize) break
    if (collected.length >= count) break
  }

  return collected
}
