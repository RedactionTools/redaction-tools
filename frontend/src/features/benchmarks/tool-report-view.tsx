'use client'

import Link from 'next/link'

import { Skeleton } from '@/components/ui/skeleton'
import { ToolLogo } from '@/features/catalog/tool-logo'
import { useGetBenchmarkToolReport } from '@/lib/api/generated/benchmarks/benchmarks'
import type { GetBenchmarkToolReportParams } from '@/lib/api/generated/model'
import { surfaceLabel } from '@/lib/benchmarks/format'

import { type Breakdowns, ReportBreakdowns, ReportHero } from './report-sections'
import { RunCards } from './run-cards'

/** One tool's pooled report, one section per surface (web app, API, desktop). */
export function ToolReportView({
  suite,
  slug,
  params,
}: {
  suite: string
  slug: string
  params: GetBenchmarkToolReportParams
}) {
  const { data } = useGetBenchmarkToolReport(suite, slug, params)
  if (!data) return <Skeleton className="h-64 w-full" />

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-muted-foreground text-sm">
          <Link href={`/benchmarks/${suite}?revision=${data.revision}`} className="hover:underline">
            {suite.toUpperCase()} benchmark {data.revision}
          </Link>
        </p>
        <div className="flex items-center gap-4">
          <ToolLogo name={data.tool.name} logoUrl={data.tool.logo_url} size="lg" />
          <h1 className="text-3xl font-semibold">{data.tool.name}</h1>
        </div>
        {data.tool.listable ? (
          <Link href={`/tool/${data.tool.slug}`} className="text-sm hover:underline">
            Pricing and features
          </Link>
        ) : null}
      </header>

      {data.surfaces.map((surface) => (
        <section key={surface.surface} className="space-y-6">
          <h2 className="text-xl font-semibold">{surfaceLabel(surface.surface)}</h2>
          <ReportHero
            summary={surface.summary}
            caseCount={data.case_count}
            testId={`report-hero-${surface.surface}`}
          />
          {surface.runs_excluded ? (
            <p className="text-muted-foreground text-sm">
              {surface.runs_excluded} older {surface.runs_excluded === 1 ? 'run was' : 'runs were'}{' '}
              scored under different thresholds and are not pooled here.
            </p>
          ) : null}
          <ReportBreakdowns breakdowns={surface.breakdowns as Breakdowns} />
          <div className="space-y-3">
            <h3 className="font-semibold">Case by case</h3>
            <RunCards suite={suite} runs={surface.runs} heading="case" />
          </div>
        </section>
      ))}
    </div>
  )
}
