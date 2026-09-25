'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetBenchmarkCase } from '@/lib/api/generated/benchmarks/benchmarks'
import type { GetBenchmarkCaseParams } from '@/lib/api/generated/model'

import { CasePreview } from './case-preview'
import { RunCards } from './run-cards'

const COMPOSITION = [
  ['by_channel', 'Where the values live'],
  ['by_category', 'What they are'],
  ['by_severity', 'How much they matter'],
  ['by_trap', 'Traps'],
] as const

/** One case: the PDF to run, what it contains (counts only - never the values), and
 * every tool's result on it. */
export function CaseView({
  suite,
  caseId,
  params,
}: {
  suite: string
  caseId: string
  params: GetBenchmarkCaseParams
}) {
  const { data } = useGetBenchmarkCase(suite, caseId, params)
  if (!data) return <Skeleton className="h-64 w-full" />

  const summary = data.probe_summary as Record<string, Record<string, number> | number>

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-muted-foreground text-sm">
          <Link href={`/benchmarks/${suite}?revision=${data.revision}`} className="hover:underline">
            {suite.toUpperCase()} benchmark {data.revision}
          </Link>
        </p>
        <h1 className="font-mono text-2xl font-semibold">{data.case_id}</h1>
        <p className="text-muted-foreground">
          {data.family} · {data.probe_count} probes · {summary.targets as number} to redact,{' '}
          {summary.distractors as number} to keep
        </p>
        <Button asChild>
          <a href={data.pdf_url} download>
            Download the case PDF
          </a>
        </Button>
      </header>

      <div className="grid gap-8 md:grid-cols-[minmax(0,24rem)_1fr]">
        {data.preview ? (
          <figure className="space-y-2">
            <CasePreview caseId={data.case_id} preview={data.preview} />
            <figcaption className="text-muted-foreground text-xs">
              Page 1 of {data.page_count}. Select to enlarge.
            </figcaption>
          </figure>
        ) : null}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">What is in it</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {COMPOSITION.map(([key, title]) => {
              const counts = summary[key]
              if (!counts || typeof counts !== 'object' || !Object.keys(counts).length) return null
              return (
                <div key={key} className="space-y-1 text-sm">
                  <h3 className="text-muted-foreground">{title}</h3>
                  <dl className="grid grid-cols-[1fr_auto] gap-x-3">
                    {Object.entries(counts).map(([name, count]) => (
                      <div key={name} className="contents">
                        <dt className="font-mono text-xs">{name}</dt>
                        <dd className="tabular-nums">{count}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Results on this case</h2>
        {data.runs.length ? (
          <RunCards suite={suite} runs={data.runs} heading="tool" />
        ) : (
          <p className="text-muted-foreground">No tool has a published result on this case yet.</p>
        )}
      </section>
    </div>
  )
}
