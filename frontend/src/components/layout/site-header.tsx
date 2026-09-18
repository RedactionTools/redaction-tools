import Link from 'next/link'

import { Container } from '@/components/layout/container'
import { GitHubLink } from '@/components/layout/github-link'
import { Logo } from '@/components/layout/logo'
import { MobileNav } from '@/components/layout/mobile-nav'
import { NAV_LINKS } from '@/components/layout/nav-links'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { UserMenu } from '@/features/account/user-menu'

export function SiteHeader() {
  return (
    // Sticky rather than fixed: it keeps its place in the flex column, so the
    // page below needs no compensating top padding. z-40 sits under the account
    // dropdown's portalled z-50 content and over everything in the page body,
    // and the background is load-bearing - without it the page scrolls through.
    <header className="border-border bg-background sticky top-0 z-40 border-b">
      <Container className="flex h-14 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo />
          Redaction Tools
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          {/* The destinations fold into the drawer below `md`; the theme and
              account controls do not, because signing in and reading in the
              dark should not cost a tap through a menu. */}
          <nav aria-label="Main" className="hidden items-center gap-6 text-sm md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <GitHubLink />
          </nav>
          <ThemeToggle />
          <UserMenu />
          <MobileNav />
        </div>
      </Container>
    </header>
  )
}
