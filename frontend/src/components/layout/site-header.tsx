import Link from 'next/link'

import { Container } from '@/components/layout/container'
import { Logo } from '@/components/layout/logo'
import { UserMenu } from '@/features/account/user-menu'

export function SiteHeader() {
  return (
    <header className="border-border border-b">
      <Container className="flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo />
          Redaction Tools
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/methodology" className="text-muted-foreground hover:text-foreground">
            Methodology
          </Link>
          <Link href="/submit" className="text-muted-foreground hover:text-foreground">
            Submit a tool
          </Link>
          <UserMenu />
        </nav>
      </Container>
    </header>
  )
}
