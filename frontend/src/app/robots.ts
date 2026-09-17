import type { MetadataRoute } from 'next'

import { clientEnv } from '@/lib/env'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Filtered hub URLs already emit `noindex, follow`, but noindex still
      // costs a crawl to discover. Faceted navigation is the largest single
      // source of wasted crawl budget, so it is blocked at the door too.
      disallow: ['/?*', '/account', '/auth/', '/my-listings'],
    },
    sitemap: `${clientEnv.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  }
}
