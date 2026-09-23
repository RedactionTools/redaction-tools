import type { MetadataRoute } from 'next'

import type { ToolListItemOut } from '@/lib/api/generated/model'
import { type BlogPostMeta, tagCounts } from '@/lib/blog/posts'

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

/**
 * `docPaths` is a parameter rather than something this module reads, and that is
 * not a style choice: the docs tree comes from `@/lib/source`, a fumadocs macro
 * that throws outside the bundler. This function has unit tests, so it cannot
 * import it. `app/sitemap.ts` supplies them.
 */
export function buildSitemapEntries(
  site: string,
  tools: ToolListItemOut[],
  docPaths: readonly string[] = [],
  posts: readonly BlogPostMeta[] = [],
): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    // The hub is dated by the catalog beneath it. The others have only the
    // build date to offer, which moves on every deploy while the page sits
    // still - so they carry no lastmod rather than a misleading one.
    //
    // `/methodology` is deliberately absent: it now 308s into the docs, and a
    // sitemap listing a redirect asks a crawler to spend budget proving it.
    { url: `${site}/`, lastModified: newestChange(tools), changeFrequency: 'weekly', priority: 1 },
    { url: `${site}/price-calculator`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${site}/submit`, changeFrequency: 'monthly', priority: 0.5 },
  ]

  const docRoutes: MetadataRoute.Sitemap = docPaths.map((path) => ({
    url: `${site}${path}`,
    changeFrequency: 'monthly',
    // The methodology is the page the catalog's credibility rests on; the rest
    // of the docs support it.
    priority: path === '/docs/methodology' ? 0.6 : 0.4,
  }))

  const toolRoutes: MetadataRoute.Sitemap = tools.map((tool) => ({
    url: `${site}/tool/${tool.slug}`,
    lastModified:
      tool.price_summary.last_changed_at ?? tool.price_summary.last_verified_at ?? undefined,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [...staticRoutes, ...docRoutes, ...blogRoutes(site, posts), ...toolRoutes]
}

/**
 * The blog index, its posts and its tag pages. Posts are dated by their last
 * edit, which the author sets by hand - so unlike a build date it only moves
 * when the page does. Archive pages (`/blog/page/N`) are left out: each is a
 * window that slides with every new post, never a page worth indexing.
 */
function blogRoutes(site: string, posts: readonly BlogPostMeta[]): MetadataRoute.Sitemap {
  const edited = (post: BlogPostMeta) => post.lastmod ?? post.date
  const newest = posts
    .map(edited)
    .reduce<string | undefined>((a, b) => (a && a > b ? a : b), undefined)

  return [
    { url: `${site}/blog`, lastModified: newest, changeFrequency: 'weekly', priority: 0.6 },
    ...posts.map((post) => ({
      url: `${site}${post.url}`,
      lastModified: edited(post),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...tagCounts(posts).map((tag) => ({
      url: `${site}/blog/tags/${tag.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.3,
    })),
  ]
}
