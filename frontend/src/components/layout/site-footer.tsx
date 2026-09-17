import Link from 'next/link'

import { Container } from '@/components/layout/container'

export function SiteFooter() {
  return (
    <footer className="border-border mt-16 border-t py-8">
      <Container className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Catalog of redaction tools with benchmarks and a leaderboard.
        </p>
        <nav className="text-muted-foreground flex flex-wrap gap-4 text-sm">
          <Link href="/" className="hover:text-foreground">
            All tools
          </Link>
          <Link href="/methodology" className="hover:text-foreground">
            How we verify prices
          </Link>
          <Link href="/submit" className="hover:text-foreground">
            Submit a tool
          </Link>
          <Link href="/my-listings" className="hover:text-foreground">
            Your listings
          </Link>
        </nav>
      </Container>
    </footer>
  )
}
