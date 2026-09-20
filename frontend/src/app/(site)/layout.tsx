import { Container } from '@/components/layout/container'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
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
 * This is also the file that renders the links `sameAs` claims, so the claim
 * and its evidence share one blast radius.
 */
function siteJsonLd(): string {
  const site = clientEnv.NEXT_PUBLIC_SITE_URL

  return combineJsonLd([
    websiteJsonLd(site, { name: SITE_NAME, description: SITE_DESCRIPTION }),
    organizationJsonLd(site, {
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      logo: `${site}/images/RedactionToolsLogo.png`,
      sameAs: SITE_SOCIAL_URLS,
    }),
  ])
}

export default function SiteLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: siteJsonLd() }} />
      <SiteHeader />
      <main className="flex-1 py-8 md:py-12">
        <Container>{children}</Container>
      </main>
      <SiteFooter />
    </div>
  )
}
