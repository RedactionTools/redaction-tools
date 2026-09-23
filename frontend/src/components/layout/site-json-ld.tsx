import { clientEnv } from '@/lib/env'
import { combineJsonLd, organizationJsonLd, websiteJsonLd } from '@/lib/seo/json-ld'
import { SITE_DESCRIPTION, SITE_NAME, SITE_SOCIAL_URLS } from '@/lib/seo/site'

/**
 * The site's own identity, declared once for every page a crawler may fetch.
 *
 * It lives here rather than in the root layout on purpose. The root also wraps
 * `/auth/*`, which `robots.ts` disallows - declaring who we are on a page we
 * have forbidden crawling is noise on every OAuth round trip - and it backs
 * `global-error.tsx`, where identity markup in a crash path is pure liability.
 *
 * Rendered by the two layouts that hold indexable pages: `(site)` and `/docs`.
 */
export function SiteJsonLd() {
  const site = clientEnv.NEXT_PUBLIC_SITE_URL

  const json = combineJsonLd([
    websiteJsonLd(site, { name: SITE_NAME, description: SITE_DESCRIPTION }),
    organizationJsonLd(site, {
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      logo: `${site}/images/RedactionToolsLogo.png`,
      sameAs: SITE_SOCIAL_URLS,
    }),
  ])

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}
