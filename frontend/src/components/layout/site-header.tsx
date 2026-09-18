import Link from 'next/link'

import { Container } from '@/components/layout/container'
import { GitHubLink } from '@/components/layout/github-link'
import { Logo } from '@/components/layout/logo'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { UserMenu } from '@/features/account/user-menu'

export function SiteHeader() {
  return (
    // Sticky rather than fixed: it keeps its place in the flex column, so the
    // page below needs no compensating top padding. z-40 sits under the account
    // dropdown's portalled z-50 content and over everything in the page body,
    // and the background is load-bearing - without it the page scrolls through.
    <header className="border-border bg-background sticky top-0 z-40 border-b">
      <Container className="flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo />
          Redaction Tools
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/price-calculator" className="text-muted-foreground hover:text-foreground">
            Price calculator
          </Link>
          <Link href="/methodology" className="text-muted-foreground hover:text-foreground">
            Methodology
          </Link>
          <Link href="/submit" className="text-muted-foreground hover:text-foreground">
            Submit a tool
          </Link>
          <GitHubLink />
          <ThemeToggle />
          <UserMenu />
        </nav>
      </Container>
    </header>
  )
}
