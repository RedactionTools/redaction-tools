import type { Metadata } from 'next'

import { Providers } from '@/components/providers/providers'
import { clientEnv } from '@/lib/env'
import { SITE_OPEN_GRAPH } from '@/lib/seo/canonical'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo/site'
// Registers the auth()-backed token source for the server bundle.
import '@/lib/api/token-source.server'

import './globals.css'

/**
 * The only `openGraph` and `twitter` in the app, and it has to stay that way.
 *
 * Next assigns these two keys, it does not merge them: a page declaring
 * `openGraph: { url }` silently drops `siteName`, `locale` and the OG image
 * along with it. Nothing needs to - `og:title` and `og:description` are filled
 * from each page's own resolved title and description, and `twitter:*` is
 * filled from `openGraph`, which is also why there is no `twitter-image`.
 *
 * No `openGraph.url` here: set at the root it would stamp the homepage URL
 * onto every page. Pages state their own through `canonicalMetadata`, which
 * returns it alongside the canonical so the two cannot disagree. Pages that
 * declare no metadata at all - `/account`, the auth screens - fall back to
 * this block and simply carry no `og:url`, which is right: none is shared.
 */
export const metadata: Metadata = {
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: SITE_OPEN_GRAPH,
  twitter: { card: 'summary_large_image' },
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
