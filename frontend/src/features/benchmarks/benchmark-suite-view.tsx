'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetBenchmarkSuite } from '@/lib/api/generated/benchmarks/benchmarks'
import type { GetBenchmarkSuiteParams } from '@/lib/api/generated/model'
import { cn } from '@/lib/utils'

import { previewAlt } from './case-preview'
import { LeaderboardTable } from './leaderboard-table'

/**
 * A suite's page: the leaderboard for one revision, and the cases behind it.
 *
 * `params` is the exact object the page prefetched with, so this reads the hydrated
 * cache on first paint rather than fetching again.
 */
export function BenchmarkSuiteView({
  suite,
  params,
}: {
  suite: string
  params: GetBenchmarkSuiteParams
}) {
  const { data } = useGetBenchmarkSuite(suite, params)
  if (!data) return <Skeleton className="h-64 w-full" />

  const revision = data.revision.revision
  const base = `/benchmarks/${suite}?revision=${revision}`

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-muted-foreground text-sm">
          <Link href="/benchmarks" className="hover:underline">
            Benchmarks
          </Link>
        </p>
        <h1 className="text-3xl font-semibold">{data.name} benchmark</h1>
        <p className="text-muted-foreground max-w-2xl">{data.description_md}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href={`/benchmarks/${suite}/submit`}>Submit results</Link>
          </Button>
          <Link href="/docs/benchmarks" className="text-sm hover:underline">
            How we score
          </Link>
        </div>
      </header>

      <section className="space-y-4" aria-labelledby="leaderboard-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 id="leaderboard-heading" className="text-xl font-semibold">
              Leaderboard
            </h2>
            <nav aria-label="Dataset revision" className="flex flex-wrap gap-2 text-sm">
              {data.revisions.map((r) =>
                r.revision === revision ? (
                  <span key={r.revision} aria-current="page" className="font-semibold">
                    {r.revision}
                  </span>
                ) : (
                  <Link
                    key={r.revision}
                    href={`/benchmarks/${suite}?revision=${r.revision}`}
                    className="text-muted-foreground hover:underline"
                  >
                    {r.revision}
                  </Link>
                ),
              )}
            </nav>
          </div>
          <nav aria-label="Which results" className="flex gap-1 text-sm">
            <ScopeLink href={base} active={data.scope === 'all'}>
              All results
            </ScopeLink>
            <ScopeLink href={`${base}&scope=verified`} active={data.scope === 'verified'}>
              Verified only
            </ScopeLink>
          </nav>
        </div>
        <LeaderboardTable
          suite={suite}
          revision={revision}
          rows={data.leaderboard}
          caseCount={data.cases.length + data.holdout_case_count}
        />
      </section>

      <section className="space-y-4" aria-labelledby="cases-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="cases-heading" className="text-xl font-semibold">
              Cases
            </h2>
            <p className="text-muted-foreground text-sm">
              Run these through a tool, then submit what it hands back.
            </p>
          </div>
          {data.revision.case_pack_url ? (
            <Button asChild variant="outline">
              <a href={data.revision.case_pack_url} download>
                Download all {data.cases.length} {data.cases.length === 1 ? 'case' : 'cases'} (.zip)
              </a>
            </Button>
          ) : null}
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.cases.map((item) => (
            <li key={item.case_id}>
              <Card className="space-y-3 p-4">
                {item.preview ? (
                  <Link
                    href={`/benchmarks/${suite}/cases/${item.case_id}?revision=${revision}`}
                    className="border-border block overflow-hidden rounded-md border"
                  >
                    {/* The page itself: which case is which is easier to see than to read. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.preview.url}
                      srcSet={item.preview.srcset}
                      sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
                      width={item.preview.width}
                      height={item.preview.height}
                      alt={previewAlt(item.case_id)}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[3/2] w-full object-cover object-top"
                    />
                  </Link>
                ) : null}
                <CardTitle className="font-mono text-sm">
                  <Link
                    href={`/benchmarks/${suite}/cases/${item.case_id}?revision=${revision}`}
                    className="hover:underline"
                  >
                    {item.case_id}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {item.probe_count} probes · {item.page_count}{' '}
                  {item.page_count === 1 ? 'page' : 'pages'}
                </CardDescription>
                <a
                  href={item.pdf_url}
                  download
                  aria-label={`Download ${item.case_id}`}
                  className="text-sm font-medium hover:underline"
                >
                  Download PDF
                </a>
              </Card>
            </li>
          ))}
        </ul>
        {data.holdout_case_count ? (
          <p className="text-muted-foreground text-sm">
            {data.holdout_case_count} holdout{' '}
            {data.holdout_case_count === 1 ? 'case is' : 'cases are'} scored but not published, so
            no tool can be tuned against them.
          </p>
        ) : null}
      </section>
    </div>
  )
}

function ScopeLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-md px-3 py-1.5',
        active ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/60',
      )}
    >
      {children}
    </Link>
  )
}
