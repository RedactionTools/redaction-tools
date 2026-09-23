import { Container } from '@/components/layout/container'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteJsonLd } from '@/components/layout/site-json-ld'

export default function SiteLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteJsonLd />
      <SiteHeader />
      <main className="flex-1 py-8 md:py-12">
        <Container>{children}</Container>
      </main>
      <SiteFooter />
    </div>
  )
}
