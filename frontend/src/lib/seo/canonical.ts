import type { Metadata } from 'next'

import { OG_CONTENT_TYPE, OG_SIZE, SITE_OG_ALT } from '@/lib/seo/og'
import { SITE_NAME } from '@/lib/seo/site'

/**
 * What every page says about itself, minus the URL - the part the root layout
 * declares so that pages setting no metadata of their own still carry it.
 */
export const SITE_OPEN_GRAPH = {
  type: 'website',
  siteName: SITE_NAME,
  locale: 'en_US',
} as const

/** The default card, named by hand because a page that declares `openGraph`
 *  stops Next naming it for them. Width, height and type come with it: they
 *  are what a scraper uses to lay the card out before fetching the image. */
const SITE_OG_IMAGE = {
  url: '/opengraph-image',
  width: OG_SIZE.width,
  height: OG_SIZE.height,
  type: OG_CONTENT_TYPE,
  alt: SITE_OG_ALT,
}

/**
 * A page's own URL, stated in the two places that read it.
 *
 * `alternates.canonical` is what a search engine consolidates on. `og:url` is
 * what a social scraper treats as the identity of the thing being shared, and
 * Next derives it from nothing: `resolveOpenGraph` leaves it null unless it is
 * set explicitly, and it never looks at the canonical. Left unset, a link
 * shared with a tracking parameter on it becomes a separate object with its own
 * counts, and the scraper has only the URL it happened to fetch.
 *
 * The two are returned together because they have to agree, and because
 * `openGraph` is assigned wholesale rather than merged - a page setting
 * `openGraph: { url }` on its own would silently drop the site name, locale and
 * type. This hands back all four, which is why a page never writes the key
 * itself.
 *
 * The `images` handling is the subtle part. Next re-injects a route's own
 * `opengraph-image` file only when that route's own metadata has not set
 * `images` - and it does so per segment, so a page declaring `openGraph`
 * discards the card inherited from the root and gets nothing back unless its
 * own directory holds one. A page with no card of its own therefore has to
 * name the site's explicitly; `hasRouteImage` is how the one route that draws
 * its own (a tool profile) stands aside and lets Next inject it.
 */
export function canonicalMetadata(
  path: string,
  {
    hasRouteImage = false,
    socialTitle,
    socialDescription,
  }: { hasRouteImage?: boolean; socialTitle?: string; socialDescription?: string } = {},
): Pick<Metadata, 'alternates' | 'openGraph'> {
  return {
    alternates: { canonical: path },
    openGraph: {
      ...SITE_OPEN_GRAPH,
      // Relative, like the canonical beside it: both resolve against
      // `metadataBase`, so neither hardcodes the origin.
      url: path,
      // Left unset, Next fills og:title and og:description from the page's own
      // title and description, which is what nearly every page wants. Passing
      // them is how a page says the share card should read differently - a
      // title written to win a search result rarely reads well on a card.
      ...(socialTitle ? { title: socialTitle } : {}),
      ...(socialDescription ? { description: socialDescription } : {}),
      ...(hasRouteImage ? {} : { images: [SITE_OG_IMAGE] }),
    },
  }
}
