import type { MetadataRoute } from 'next'

import { listTools } from '@/lib/api/generated/catalog/catalog'
import { buildSitemapEntries } from '@/lib/catalog/sitemap'
import { clientEnv } from '@/lib/env'

// Never prerendered: `next build` runs with no backend reachable, and a sitemap
// baked at build time would ship an empty one for the life of the image.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = clientEnv.NEXT_PUBLIC_SITE_URL

  try {
    const page = await listTools({ page_size: 100 })
    return buildSitemapEntries(site, page.items)
  } catch {
    // An API outage degrades the sitemap to its static routes rather than
    // serving a 500 to a crawler, which is the more expensive failure.
    return buildSitemapEntries(site, [])
  }
}
