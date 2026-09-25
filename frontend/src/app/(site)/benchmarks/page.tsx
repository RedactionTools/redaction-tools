import Link from 'next/link'
import type { Metadata } from 'next'

import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { listBenchmarkSuites } from '@/lib/api/generated/benchmarks/benchmarks'
import type { SuiteSummaryOut } from '@/lib/api/generated/model'
import { canonicalMetadata } from '@/lib/seo/canonical'

// Per request: the image is built with no backend, and a prerendered page would bake
// "no benchmarks" into it.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Redaction benchmarks — measured leak rates by tool',
  description:
    'Independent benchmarks of redaction tools: synthetic documents with known sensitive values, and how many each tool leaves recoverable, layer by layer.',
  ...canonicalMetadata('/benchmarks'),
}

/** The media we plan to benchmark, shown as coming until a suite exists for them. */
const PLANNED = ['Images', 'Audio', 'Video']

export default async function BenchmarksPage() {
  let suites: SuiteSummaryOut[] = []
  try {
    suites = await listBenchmarkSuites()
  } catch {
    // An outage shows the planned media and no suites, rather than a 500 on a page
    // that is mostly explanation.
  }

  return (
    <div className="space-y-10">
      <header className="max-w-2xl space-y-3">
        <h1 className="text-3xl font-semibold">Benchmarks</h1>
        <p className="text-muted-foreground">
          We generate documents with sensitive values planted where redaction tools miss them, run
          each tool, and count what is still recoverable from what it hands back. Every result says
          who ran it and whether we scored it ourselves.
        </p>
        <Link href="/docs/benchmarks" className="text-sm font-medium hover:underline">
          How we score
        </Link>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {suites.map((suite) => (
          <li key={suite.slug}>
            <Card className="h-full space-y-2">
              <CardTitle>
                <Link href={`/benchmarks/${suite.slug}`} className="hover:underline">
                  {suite.name}
                </Link>
              </CardTitle>
              <CardDescription>{suite.description_md}</CardDescription>
              <p className="text-sm tabular-nums">
                {suite.tool_count} {suite.tool_count === 1 ? 'tool' : 'tools'} · {suite.case_count}{' '}
                {suite.case_count === 1 ? 'case' : 'cases'} · {suite.current_revision}
              </p>
            </Card>
          </li>
        ))}
        {PLANNED.map((name) => (
          <li key={name}>
            <Card className="h-full space-y-2 border-dashed">
              <CardTitle className="text-muted-foreground">{name}</CardTitle>
              <CardDescription>Coming.</CardDescription>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
