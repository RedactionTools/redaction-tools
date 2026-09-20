import { fetchAllTools } from '@/lib/catalog/server'
import { clientEnv } from '@/lib/env'
import { buildLlmsTxt } from '@/lib/seo/llms'

// Like the sitemap: `next build` runs with no backend, and a file baked then
// would advertise an empty catalog for the life of the image.
export const dynamic = 'force-dynamic'

/**
 * `s-maxage` is inert today - Caddy does not cache - and correct the day
 * anything does. No `X-Robots-Tag`: this file exists to be read.
 */
const HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
}

export async function GET(): Promise<Response> {
  const site = clientEnv.NEXT_PUBLIC_SITE_URL

  // `fetchAllTools` degrades to [] rather than throwing, so a backend blip
  // costs the tool list rather than serving a crawler a 500.
  return new Response(buildLlmsTxt(site, await fetchAllTools(), new Date()), { headers: HEADERS })
}
