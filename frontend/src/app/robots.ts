import type { MetadataRoute } from 'next'

import { clientEnv } from '@/lib/env'
import { buildRobots } from '@/lib/seo/robots'

export default function robots(): MetadataRoute.Robots {
  return buildRobots(clientEnv.NEXT_PUBLIC_SITE_URL)
}
