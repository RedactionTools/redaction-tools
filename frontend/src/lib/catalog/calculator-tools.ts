/**
 * How many tools the calculator will price at once.
 *
 * Past a handful the merged table stops being a comparison and starts being a
 * list, and each tool is one more detail request. The cap lives here rather
 * than in the picker so a hand-edited URL obeys it too.
 */
export const MAX_TOOLS = 5

/** The tools the URL names, in its own order, each one once. */
export function toolSlugs(params: Record<string, string | string[] | undefined>): string[] {
  const value = params.tool
  const raw = Array.isArray(value) ? value : value ? [value] : []
  return [...new Set(raw.filter(Boolean))].slice(0, MAX_TOOLS)
}

/** The calculator's own URL for a selection. */
export function toolsHref(pathname: string, slugs: string[]): string {
  const params = new URLSearchParams(slugs.map((slug) => ['tool', slug]))
  return slugs.length ? `${pathname}?${params}` : pathname
}
