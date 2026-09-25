'use client'

import Link from 'next/link'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetBenchmarkRun } from '@/lib/api/generated/benchmarks/benchmarks'
import type { PooledOut, RateOut } from '@/lib/api/generated/model'
import { roleLabel, surfaceLabel } from '@/lib/benchmarks/format'

import { OverlayFigure } from './overlay-figure'
import { type Breakdowns, ReportBreakdowns, ReportHero } from './report-sections'

type Report = Breakdowns & {
  summary?: { over_redaction_rate?: RateOut }
  survivability?: { gates?: { gate: string; passed: boolean; detail: string }[] }
  alignment?: { method?: string; residual_px?: number; confident?: boolean }
  engines?: Record<string, string>
  notes?: string[]
}

/** One run, whole: pdfredeval's report.json rendered by us, never its HTML. */
export function RunReportView({ suite, runId }: { suite: string; runId: string }) {
  const { data: run } = useGetBenchmarkRun(runId)
  if (!run) return <Skeleton className="h-64 w-full" />

  const report = run.report as Report
  const gates = report.survivability?.gates ?? []
  // One run's report reads like a pooled one of one: the same sections, n of one case.
  const summary: PooledOut = {
    leak_rate: run.leak_rate,
    over_redaction_rate: report.summary?.over_redaction_rate ?? {
      value: null,
      n: 0,
      count: 0,
      ci95: null,
    },
    counts: run.counts,
    cases: 1,
    gates_failed: run.gates_passed === false ? 1 : 0,
    lowest_text_retention: run.text_retention,
    provenance: run.provenance,
  }
  const breakdowns: Breakdowns = {
    ...report,
    gates: Object.fromEntries(
      gates.map((gate) => [gate.gate, { failed: gate.passed ? 0 : 1, runs: 1 }]),
    ),
  }
  const diff = Object.entries(
    run.verification_diff as Record<string, { claimed: unknown; ours: unknown }>,
  )

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-muted-foreground text-sm">
          <Link href={`/benchmarks/${suite}?revision=${run.revision}`} className="hover:underline">
            {suite.toUpperCase()} benchmark {run.revision}
          </Link>
          {run.tool.listable ? (
            <>
              {' / '}
              <Link
                href={`/benchmarks/${suite}/tools/${run.tool.slug}?revision=${run.revision}`}
                className="hover:underline"
              >
                {run.tool.name}
              </Link>
            </>
          ) : null}
        </p>
        <h1 className="text-3xl font-semibold">
          {run.tool.name} on {run.case_id}
        </h1>
        <p className="text-muted-foreground text-sm">
          {surfaceLabel(run.surface)}
          {run.tier ? ` · ${run.tier}` : ''}
          {run.tool_version ? ` · version ${run.tool_version}` : ''} · published by{' '}
          <span className="text-foreground font-medium">{run.submitter.name}</span> (
          {roleLabel(run.submitter.role)})
        </p>
      </header>

      <ReportHero summary={summary} caseCount={1} testId="run-hero" />

      {diff.length ? (
        <Card className="space-y-2" data-testid="verification-diff">
          <h2 className="font-semibold">Our rescore disagrees</h2>
          <p className="text-muted-foreground text-sm">
            The submitter scored this run themselves. Scoring the same PDF, we got:
          </p>
          <table className="text-sm">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="pr-6 font-normal">Field</th>
                <th className="pr-6 font-normal">Claimed</th>
                <th className="font-normal">Ours</th>
              </tr>
            </thead>
            <tbody>
              {diff.map(([field, values]) => (
                <tr key={field}>
                  <td className="pr-6 font-mono">{field}</td>
                  <td className="pr-6 tabular-nums">{String(values.claimed)}</td>
                  <td className="tabular-nums">{String(values.ours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <ReportBreakdowns breakdowns={breakdowns} />
        <aside className="space-y-4">
          {run.overlay ? <OverlayFigure overlay={run.overlay} label={run.case_id} /> : null}
          <div className="flex flex-col gap-2 text-sm">
            {run.output_pdf_url ? (
              <a href={run.output_pdf_url} className="hover:underline">
                Download the redacted PDF
              </a>
            ) : null}
            <Link
              href={`/benchmarks/${suite}/cases/${run.case_id}?revision=${run.revision}`}
              className="hover:underline"
            >
              The case, and every tool on it
            </Link>
          </div>
        </aside>
      </div>

      <section className="space-y-2" data-testid="run-provenance">
        <h2 className="text-xl font-semibold">Provenance</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[12rem_1fr]">
          <dt className="text-muted-foreground">Scored with</dt>
          <dd>
            {run.scorer_version
              ? `pdfredeval ${run.scorer_version}`
              : 'pdfredeval (submitter’s copy)'}
          </dd>
          <dt className="text-muted-foreground">Engines</dt>
          <dd className="font-mono text-xs">
            {Object.entries(report.engines ?? {})
              .map(([name, version]) => `${name} ${version}`)
              .join(' · ')}
          </dd>
          <dt className="text-muted-foreground">Alignment</dt>
          <dd>
            {report.alignment?.method ?? '—'}
            {report.alignment?.residual_px !== undefined
              ? `, residual ${report.alignment.residual_px} px`
              : ''}
            {report.alignment?.confident === false ? ' (not confident)' : ''}
          </dd>
          <dt className="text-muted-foreground">Run id</dt>
          <dd className="font-mono text-xs break-all">{run.run_id}</dd>
        </dl>
        {report.notes?.length ? (
          <ul className="text-muted-foreground list-disc pl-5 text-sm">
            {report.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
