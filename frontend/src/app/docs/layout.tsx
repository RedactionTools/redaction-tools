import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { RootProvider } from 'fumadocs-ui/provider/next'
import type { CSSProperties } from 'react'

import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteJsonLd } from '@/components/layout/site-json-ld'
import { source } from '@/lib/source'

import { DocsSearchTrigger } from './docs-chrome'

/**
 * `SiteHeader` is `sticky top-0` and `h-14`. Fumadocs sticks its sidebar, its
 * mobile sub-bar and the table of contents at `top: var(--fd-docs-row-1)`,
 * which derives from `--fd-banner-height` - so handing it the header's height
 * is what puts all three under the header instead of behind it.
 *
 * `minHeight` is inline because the container's own `min-h-(--fd-docs-height)`
 * would otherwise make the page a full viewport taller than the screen and push
 * the footer permanently below the fold.
 *
 * `--fd-layout-width` is narrowed from its 97rem default: the header and footer
 * are `max-w-5xl`, and docs wider than their own chrome read as a different
 * site.
 */
const DOCS_CHROME = {
  '--fd-banner-height': '3.5rem',
  '--fd-layout-width': '84rem',
  minHeight: 'calc(100dvh - 3.5rem)',
} as CSSProperties

export default function DocsRouteLayout({ children }: LayoutProps<'/docs'>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteJsonLd />
      {/* `theme.enabled: false` because the root `Providers` already mounts
          next-themes; a second provider fights it over the `.dark` class. It
          also drops fumadocs' bare-`d` theme hotkey, which has no place on a
          page of prose. RootProvider wraps the header too, so the header's
          search button shares the dialog context. */}
      <RootProvider theme={{ enabled: false }}>
        <SiteHeader actions={<DocsSearchTrigger />} />
        <div className="flex-1">
          <DocsLayout
            tree={source.getPageTree()}
            // Not `enabled: false`: this "nav" is the `md:hidden` sub-bar that
            // carries the sidebar drawer trigger, so disabling it leaves phone
            // readers with no way to open the sidebar. Above `md` it renders
            // nothing.
            nav={{ title: 'Docs', url: '/docs' }}
            // SiteHeader already has one, and two theme controls on a page is
            // a bug.
            themeSwitch={{ enabled: false }}
            containerProps={{ style: DOCS_CHROME }}
          >
            {children}
          </DocsLayout>
        </div>
        <SiteFooter />
      </RootProvider>
    </div>
  )
}
