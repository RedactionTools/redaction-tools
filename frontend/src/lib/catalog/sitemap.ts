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
export function buildSitemapEntries(site: string, tools: ToolListItemOut[]): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${site}/`, changeFrequency: 'weekly', priority: 1 },
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
