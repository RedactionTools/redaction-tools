import { getToolBadges } from '@/lib/api/generated/catalog/catalog'
import { parseBadgeColor, parseBadgeFile, parseBadgeTheme, renderBadge } from '@/lib/badges/svg'

// What a tool has earned changes at runtime, and `next build` runs with no
// backend: nothing here may be prerendered.
export const dynamic = 'force-dynamic'

/** An hour: a lapsed badge goes grey within one, without a request per page view. */
const EARNED_FOR = 'public, max-age=3600, s-maxage=3600'
/** A backend blip draws grey too, but must not pin it there for the hour. */
const FAILED_FOR = 'public, max-age=60, s-maxage=60'

/**
 * An owner's embeddable badge: `/badge/<slug>/<kind>.svg?theme=&color=`.
 *
 * It is an <img> on somebody else's page, so it never errors for a known kind -
 * a badge with nothing to claim, or a backend that did not answer, is grey.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; kind: string }> },
): Promise<Response> {
  const { slug, kind: file } = await params
  const kind = parseBadgeFile(file)
  if (!kind) return new Response('Unknown badge.', { status: 404 })

  const query = new URL(request.url).searchParams
  let earned = false
  let cacheControl = EARNED_FOR
  try {
    earned = (await getToolBadges(slug))[kind]
  } catch {
    cacheControl = FAILED_FOR
  }

  const svg = renderBadge({
    kind,
    earned,
    theme: parseBadgeTheme(query.get('theme')),
    color: parseBadgeColor(query.get('color')),
  })
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': cacheControl,
      // Belt and braces for a file served from our origin: should anyone open
      // it directly, it is still only a picture.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
