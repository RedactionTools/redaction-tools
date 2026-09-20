import { ImageResponse } from 'next/og'

import { OG_CONTENT_TYPE, OG_SIZE, SITE_OG_ALT } from '@/lib/seo/og'
import { SiteCard } from '@/lib/seo/og-card'

export const alt = SITE_OG_ALT
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

/**
 * The default share card. Prerendered at build, which is safe: it reads nothing
 * from the API, so it does not run into the no-backend build the rest of the
 * catalog has to dodge.
 */
export default function Image() {
  return new ImageResponse(
    <SiteCard tagline="Every price with its unit, its source and the date we checked it." />,
    size,
  )
}
