import type { MetadataRoute } from 'next'

import type { ToolListItemOut } from '@/lib/api/generated/model'

/**
 * The sitemap, built from whatever the API returned.
 *
 * `lastModified` is the last price *change*, not the last verification. Prices
 * are re-checked far more often than they move, so dating entries by the check
 * would push a fresh lastmod for every tool every day while the pages were
 * identical - and a section that cries wolf devalues the signal for the whole
 * domain, not just for itself.
 */
/** The freshest thing the catalog can honestly say about itself. */
function newestChange(tools: ToolListItemOut[]): string | undefined {
  const dates = tools
    .map((tool) => tool.price_summary.last_changed_at ?? tool.price_summary.last_verified_at)
    .filter((date): date is string => Boolean(date))

  return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : undefined
}

export function buildSitemapEntries(site: string, tools: ToolListItemOut[]): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    // The hub is dated by the catalog beneath it. The other three have only the
    // build date to offer, which moves on every deploy while the page sits
    // still - so they carry no lastmod rather than a misleading one.
    { url: `${site}/`, lastModified: newestChange(tools), changeFrequency: 'weekly', priority: 1 },
    { url: `${site}/price-calculator`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${site}/methodology`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${site}/submit`, changeFrequency: 'monthly', priority: 0.5 },
  ]

  const toolRoutes: MetadataRoute.Sitemap = tools.map((tool) => ({
    url: `${site}/tool/${tool.slug}`,
    lastModified:
      tool.price_summary.last_changed_at ?? tool.price_summary.last_verified_at ?? undefined,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [...staticRoutes, ...toolRoutes]
}
