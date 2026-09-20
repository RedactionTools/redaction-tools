import { ImageResponse } from 'next/og'

import { priceHeadline, verifiedOn } from '@/lib/catalog/format'
import { fetchTool } from '@/lib/catalog/server'
import { OG_SIZE, OG_CONTENT_TYPE } from '@/lib/seo/og'
import { SiteCard, ToolCard } from '@/lib/seo/og-card'

export const alt = 'Pricing card for a redaction tool'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

// Like the page it belongs to: `next build` runs with no backend reachable, so
// this must never be a candidate for prerendering.
export const dynamic = 'force-dynamic'

/**
 * The per-tool share card.
 *
 * `params` is hand-typed because `next typegen` only emits `PageProps` for
 * `page` and `route` files, and an image route is neither.
 *
 * A missing or unreachable tool falls back to the site card rather than
 * throwing: a 500 here is a broken preview on every share of the link and a
 * 5xx in Search Console, where an unbranded but valid card costs nothing.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  let tool = null
  try {
    tool = await fetchTool(slug)
  } catch {
    tool = null
  }

  if (!tool) {
    return new ImageResponse(
      <SiteCard tagline="Every price with its unit, its source and the date we checked it." />,
      size,
    )
  }

  return new ImageResponse(
    <ToolCard
      name={tool.name}
      vendor={tool.vendor.name}
      price={priceHeadline(tool.price_summary)}
      verified={verifiedOn(tool.price_summary)}
    />,
    size,
  )
}
