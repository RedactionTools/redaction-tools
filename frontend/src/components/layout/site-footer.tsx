import { Container } from '@/components/layout/container'

export function SiteFooter() {
  return (
    <footer className="border-border mt-16 border-t py-8">
      <Container>
        <p className="text-muted-foreground text-sm">
          Catalog of redaction tools with benchmarks and a leaderboard.
        </p>
      </Container>
    </footer>
  )
}
