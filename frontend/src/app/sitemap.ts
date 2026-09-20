import type { MetadataRoute } from 'next'

import { buildSitemapEntries } from '@/lib/catalog/sitemap'
import { fetchAllTools } from '@/lib/catalog/server'
import { clientEnv } from '@/lib/env'

// Never prerendered: `next build` runs with no backend reachable, and a sitemap
// baked at build time would ship an empty one for the life of the image.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // `fetchAllTools` degrades to [] on an outage, so a blip costs the tool URLs
  // rather than serving a crawler a 500.
  return buildSitemapEntries(clientEnv.NEXT_PUBLIC_SITE_URL, await fetchAllTools())
}
