import Link from 'next/link'

import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">
        Find the right redaction tool.
      </h1>
      <p className="text-muted-foreground mt-4 text-pretty">
        A catalog of redaction tools with reproducible benchmarks and a leaderboard. The catalog is
        not published yet — the API currently exposes health and account endpoints only.
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/account">Your account</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/health">API status</Link>
        </Button>
      </div>
    </div>
  )
}
